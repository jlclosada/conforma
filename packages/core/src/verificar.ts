import type { Registro, RegistroEvento, RegistroFacturacion } from './registros.js'
import { reglasCadena, reglasCadenaEventos } from './rules/cadena.js'
import { reglasFormato } from './rules/formato.js'
import { reglasHuella } from './rules/huella.js'
import { AREAS, FALLA, areaDeRegla, type Area, type EstadoArea, type Hallazgo, type Severidad, type Veredicto } from './tipos.js'

export interface Informe {
  registros: { total: number; altas: number; anulaciones: number; eventos: number }
  hallazgos: Hallazgo[]
  porSeveridad: Record<Severidad, number>
  veredicto: Veredicto
  /** Estado de cada área: qué se ha comprobado y con qué resultado */
  cobertura: Record<Area, EstadoArea>
  /** @deprecated usa `veredicto`; equivale a `veredicto === 'aprobado'` */
  correcto: boolean
}

export interface OpcionesVerificar {
  /**
   * Áreas que quien llama ha comprobado por su cuenta (`xsd`, `qr`, `maquetacion`).
   * Si hay registros y no se incluye `xsd`, el veredicto no puede ser `aprobado`.
   */
  comprobadas?: Area[]
}

const ORDEN: Severidad[] = ['critica', 'alta', 'media', 'info']

/** Verifica un lote de registros (en orden de generación) y devuelve todos los hallazgos */
export function verificar(registros: Registro[], extra: Hallazgo[] = [], opciones: OpcionesVerificar = {}): Informe {
  const fact = registros.filter((r): r is RegistroFacturacion => r.tipo !== 'evento')
  const evs = registros.filter((r): r is RegistroEvento => r.tipo === 'evento')
  const hallazgos: Hallazgo[] = [
    ...registros.flatMap((r) => [...reglasFormato(r), ...reglasHuella(r)]),
    ...reglasCadena(fact),
    ...reglasCadenaEventos(evs),
    ...extra,
  ].sort((a, b) => (a.registro?.indice ?? -1) - (b.registro?.indice ?? -1) || ORDEN.indexOf(a.severidad) - ORDEN.indexOf(b.severidad))

  const porSeveridad = { critica: 0, alta: 0, media: 0, info: 0 } as Record<Severidad, number>
  for (const h of hallazgos) porSeveridad[h.severidad]++

  const comprobadas = new Set<Area>(opciones.comprobadas ?? [])
  if (registros.length) for (const a of ['formato', 'huella', 'cadena'] as const) comprobadas.add(a)
  const cobertura = {} as Record<Area, EstadoArea>
  for (const a of AREAS) {
    const delArea = hallazgos.filter((h) => areaDeRegla(h.regla) === a)
    cobertura[a] = delArea.some((h) => FALLA.has(h.severidad)) ? 'falla'
      : delArea.some((h) => h.noComprobado) ? 'no_comprobado'
      : comprobadas.has(a) ? 'ok'
      : registros.length && a === 'xsd' ? 'no_comprobado'
      : 'sin_datos'
  }
  const veredicto: Veredicto = hallazgos.some((h) => FALLA.has(h.severidad)) ? 'falla'
    : hallazgos.some((h) => h.noComprobado) || Object.values(cobertura).includes('no_comprobado') || !Object.values(cobertura).includes('ok') ? 'no_comprobado'
    : 'aprobado'

  return {
    registros: { total: registros.length, altas: fact.filter((r) => r.tipo === 'alta').length, anulaciones: fact.filter((r) => r.tipo === 'anulacion').length, eventos: evs.length },
    hallazgos,
    porSeveridad,
    veredicto,
    cobertura,
    correcto: veredicto === 'aprobado',
  }
}
