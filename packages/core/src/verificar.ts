import type { Registro, RegistroEvento, RegistroFacturacion } from './registros.js'
import { reglasCadena, reglasCadenaEventos } from './rules/cadena.js'
import { reglasFormato } from './rules/formato.js'
import { reglasHuella } from './rules/huella.js'
import { FALLA, type Hallazgo, type Severidad } from './tipos.js'

export interface Informe {
  registros: { total: number; altas: number; anulaciones: number; eventos: number }
  hallazgos: Hallazgo[]
  porSeveridad: Record<Severidad, number>
  /** true si no hay hallazgos críticos ni altos */
  correcto: boolean
}

const ORDEN: Severidad[] = ['critica', 'alta', 'media', 'info']

/** Verifica un lote de registros (en orden de generación) y devuelve todos los hallazgos */
export function verificar(registros: Registro[], extra: Hallazgo[] = []): Informe {
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
  return {
    registros: { total: registros.length, altas: fact.filter((r) => r.tipo === 'alta').length, anulaciones: fact.filter((r) => r.tipo === 'anulacion').length, eventos: evs.length },
    hallazgos,
    porSeveridad,
    correcto: !hallazgos.some((h) => FALLA.has(h.severidad)),
  }
}
