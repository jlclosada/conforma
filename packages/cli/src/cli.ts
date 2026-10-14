#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { parseArgs } from 'node:util'
import { analizarMaquetacionQr, analizarUrlQr, leerXml, verificar, type Hallazgo, type Registro, type RegistroAlta } from '@conforma/core'
import { validarXsd } from '@conforma/core/xsd'
import { sarif, texto } from './salida.js'

const VERSION = '0.1.0'
const AYUDA = `verifactu-lint ${VERSION} — verifica registros Verifactu en local (nada sale de tu máquina)

Uso:
  verifactu-lint <ficheros.xml...> [opciones]

Opciones:
  --qr <url|imagen|pdf>  Comprueba el código QR: una URL, una imagen PNG/JPG o una factura en PDF
                      (en el PDF también mide tamaño, margen, posición y textos). Repetible.
  --entorno <e>       Entorno esperado del QR: pruebas | produccion
  --no-xsd            No validar contra los esquemas XSD de la AEAT
  --info              Mostrar también los hallazgos informativos
  --json              Salida en JSON
  --sarif             Salida en SARIF 2.1.0 (GitHub code scanning)
  -h, --help          Esta ayuda
  -v, --version       Versión

Qué comprueba:
  · Huella SHA-256 de altas, anulaciones y eventos (con los vectores oficiales de la AEAT)
  · Encadenamiento: enlace con el registro anterior, reinicios, fechas, duplicados, anulaciones
  · Formatos: NIF, número de serie, fechas, importes, tipo de factura, tipo de huella
  · Esquemas XSD oficiales (SuministroLR, SuministroInformacion, EventosSIF)
  · URL del QR: dominio, parámetros, codificación, códigos de error de la AEAT y coherencia con el registro
  · QR en la factura PDF: 30–40 mm, nivel M, margen en blanco, primera página, posición,
    «QR tributario:» encima y «VERI*FACTU» debajo

Código de salida: 0 si no hay hallazgos críticos ni altos; 1 si los hay; 2 si hay un error de uso.`

async function main() {
  let args
  try {
    args = parseArgs({
      allowPositionals: true,
      options: {
        qr: { type: 'string', multiple: true },
        entorno: { type: 'string' },
        'no-xsd': { type: 'boolean' },
        info: { type: 'boolean' },
        json: { type: 'boolean' },
        sarif: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    })
  } catch (e) {
    console.error((e as Error).message + '\n\n' + AYUDA)
    return 2
  }
  const { values: o, positionals: ficheros } = args
  if (o.help) { console.log(AYUDA); return 0 }
  if (o.version) { console.log(VERSION); return 0 }
  if (!ficheros.length && !o.qr?.length) { console.error(AYUDA); return 2 }
  if (o.entorno && o.entorno !== 'pruebas' && o.entorno !== 'produccion') { console.error('--entorno debe ser «pruebas» o «produccion»'); return 2 }

  const registros: Registro[] = []
  const extra: Hallazgo[] = []
  for (const f of ficheros) {
    let xml: string
    try { xml = await readFile(f, 'utf8') } catch (e) { console.error(`No se puede leer ${f}: ${(e as Error).message}`); return 2 }
    let lectura
    try { lectura = leerXml(xml, { fichero: f, indiceInicial: registros.length }) } catch (e) {
      extra.push({ regla: 'XML-001', severidad: 'critica', mensaje: `${basename(f)} no es un XML válido: ${(e as Error).message}` })
      continue
    }
    if (!lectura.registros.length) extra.push({ regla: 'XML-002', severidad: 'media', mensaje: `${basename(f)} no contiene registros de alta, anulación ni evento` })
    registros.push(...lectura.registros)
    if (!o['no-xsd']) extra.push(...(await validarXsd(xml, lectura.raiz, f)))
  }

  for (const q of o.qr ?? []) {
    let urls: { texto: string; nivelCorreccion?: string }[] = [{ texto: q }]
    if (!/^https?:\/\//i.test(q) && extname(q).toLowerCase() === '.pdf') {
      const { analizarPdf } = await import('./pdf.js')
      const res = await analizarPdf(q)
      if (!res) { extra.push({ regla: 'QR-000', severidad: 'critica', mensaje: `No se ha encontrado el QR tributario en las primeras páginas de ${basename(q)}` }); continue }
      urls = [{ texto: res.url, nivelCorreccion: res.nivelCorreccion }]
      const etiqueta = `PDF ${basename(q)}`
      for (const h of analizarMaquetacionQr(res.maquetacion)) extra.push({ ...h, mensaje: `[${etiqueta}] ${h.mensaje}` })
      if (res.nivelCorreccion && res.nivelCorreccion !== 'M') extra.push({ regla: 'QR-008', severidad: 'alta', mensaje: `[${etiqueta}] El QR usa el nivel de corrección ${res.nivelCorreccion}; la orden exige el nivel M`, referencia: 'Orden HAC/1177/2024, art. 21.1' })
    } else if (!/^https?:\/\//i.test(q) && ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(q).toLowerCase())) {
      const { leerQrDeImagen } = await import('./qrimagen.js')
      urls = await leerQrDeImagen(q)
      if (!urls.length) { extra.push({ regla: 'QR-000', severidad: 'alta', mensaje: `No se ha encontrado ningún código QR legible en ${basename(q)}` }); continue }
      for (const u of urls) if (u.nivelCorreccion && u.nivelCorreccion !== 'M') extra.push({ regla: 'QR-008', severidad: 'alta', mensaje: `El QR de ${basename(q)} usa el nivel de corrección ${u.nivelCorreccion}; la orden exige el nivel M`, referencia: 'Orden HAC/1177/2024, art. 21.1' })
    }
    for (const u of urls) {
      const numserie = new URLSearchParams(u.texto.split('?')[1] ?? '').get('numserie')?.trim()
      const registro = registros.find((r): r is RegistroAlta => r.tipo === 'alta' && r.numSerie.trim() === numserie)
      const { hallazgos } = analizarUrlQr(u.texto, { registro, entorno: o.entorno as 'pruebas' | 'produccion' | undefined })
      const etiqueta = `QR ${numserie ?? u.texto.slice(0, 60)}`
      for (const h of hallazgos) extra.push({ ...h, mensaje: `[${etiqueta}] ${h.mensaje}` })
      if (numserie && registros.length && !registro) extra.push({ regla: 'QR-009', severidad: 'info', mensaje: `[${etiqueta}] No hay ningún registro de alta con ese número de serie en los ficheros: no se ha comprobado la coherencia` })
    }
  }

  const informe = verificar(registros, extra)
  if (o.json) console.log(JSON.stringify(informe, null, 2))
  else if (o.sarif) console.log(sarif(informe, VERSION))
  else console.log(texto(informe, { info: Boolean(o.info), ficheros }))
  return informe.correcto ? 0 : 1
}

main().then((code) => { process.exitCode = code }, (e) => { console.error(e); process.exitCode = 2 })
