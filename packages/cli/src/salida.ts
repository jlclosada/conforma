import pc from 'picocolors'
import type { Hallazgo, Informe, Severidad } from '@conforma/core'

const ICONO: Record<Severidad, string> = { critica: pc.red('✖'), alta: pc.red('●'), media: pc.yellow('▲'), info: pc.blue('ℹ') }
const NOMBRE: Record<Severidad, string> = { critica: pc.red('CRÍTICO'), alta: pc.red('ALTO'), media: pc.yellow('MEDIO'), info: pc.blue('INFO') }

export function texto(informe: Informe, opciones: { info: boolean; ficheros: string[] }): string {
  const l: string[] = []
  const { registros: r, porSeveridad: s } = informe
  l.push(pc.bold(`verifactu-lint · ${opciones.ficheros.length} fichero(s) · ${r.total} registro(s) (${r.altas} altas, ${r.anulaciones} anulaciones, ${r.eventos} eventos)`))
  l.push('')
  const visibles = informe.hallazgos.filter((h) => opciones.info || h.severidad !== 'info')
  let actual = ''
  for (const h of visibles) {
    const grupo = h.registro ? `#${h.registro.indice + 1} ${h.registro.tipo} ${h.registro.etiqueta}${h.registro.fichero ? pc.dim(`  (${h.registro.fichero})`) : ''}` : 'General'
    if (grupo !== actual) { l.push(pc.bold(grupo)); actual = grupo }
    l.push(`  ${ICONO[h.severidad]} ${NOMBRE[h.severidad]} ${pc.dim(h.regla)}  ${h.mensaje}`)
    if (h.esperado !== undefined) l.push(pc.dim(`      esperado: ${h.esperado}`))
    if (h.obtenido !== undefined) l.push(pc.dim(`      obtenido: ${h.obtenido}`))
    if (h.sugerencia) l.push(pc.dim(h.sugerencia.split('\n').map((x) => `      ${x}`).join('\n')))
    if (h.referencia) l.push(pc.dim(`      ref.: ${h.referencia}`))
  }
  if (visibles.length) l.push('')
  const resumen = `${s.critica} críticos · ${s.alta} altos · ${s.media} medios · ${s.info} informativos`
  l.push(informe.correcto ? pc.green(pc.bold(`✔ Sin errores críticos ni altos  (${resumen})`)) : pc.red(pc.bold(`✖ No cumple  (${resumen})`)))
  if (!opciones.info && s.info) l.push(pc.dim('  Usa --info para ver también los hallazgos informativos.'))
  l.push(pc.dim('  Verificación técnica automática: no sustituye a una revisión fiscal ni es una homologación de la AEAT.'))
  return l.join('\n')
}

const NIVEL_SARIF: Record<Severidad, string> = { critica: 'error', alta: 'error', media: 'warning', info: 'note' }

/** SARIF 2.1.0 para GitHub code scanning y otras herramientas */
export function sarif(informe: Informe, version: string): string {
  const reglas = [...new Map(informe.hallazgos.map((h) => [h.regla, h])).values()]
  const resultado = (h: Hallazgo) => ({
    ruleId: h.regla,
    level: NIVEL_SARIF[h.severidad],
    message: { text: [h.mensaje, h.esperado && `Esperado: ${h.esperado}`, h.obtenido && `Obtenido: ${h.obtenido}`].filter(Boolean).join('. ') },
    locations: h.registro?.fichero ? [{ physicalLocation: { artifactLocation: { uri: h.registro.fichero } }, logicalLocations: [{ name: `${h.registro.tipo} ${h.registro.etiqueta}`, kind: 'object' }] }] : [],
  })
  return JSON.stringify({
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'verifactu-lint', version, informationUri: 'https://github.com/jlclosada/conforma', rules: reglas.map((h) => ({ id: h.regla, shortDescription: { text: h.mensaje.slice(0, 120) }, helpUri: undefined, properties: { referencia: h.referencia } })) } },
      results: informe.hallazgos.map(resultado),
    }],
  }, null, 2)
}
