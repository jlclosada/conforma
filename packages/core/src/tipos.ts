/** Gravedad de un hallazgo. `critica` y `alta` hacen fallar la verificación. */
export type Severidad = 'critica' | 'alta' | 'media' | 'info'

export type TipoRegistro = 'alta' | 'anulacion' | 'evento'

/** Identifica un registro dentro del lote verificado. */
export interface RefRegistro {
  /** Posición en el lote (0 = primero) */
  indice: number
  tipo: TipoRegistro
  /** Nº serie + nº factura (o tipo de evento) para mostrarlo */
  etiqueta: string
  fichero?: string
}

export interface Hallazgo {
  /** Identificador estable de la regla, p. ej. `HUE-002` */
  regla: string
  severidad: Severidad
  mensaje: string
  registro?: RefRegistro
  esperado?: string
  obtenido?: string
  /** Norma o documento técnico en el que se basa la regla */
  referencia?: string
  /** Cómo arreglarlo */
  sugerencia?: string
  /** La comprobación no se ha podido hacer: el resultado nunca puede ser «aprobado» */
  noComprobado?: boolean
}

export const FALLA: ReadonlySet<Severidad> = new Set(['critica', 'alta'])

/** Áreas que se verifican. `formato`, `huella` y `cadena` se comprueban siempre que hay registros. */
export type Area = 'formato' | 'huella' | 'cadena' | 'xsd' | 'qr' | 'maquetacion'
export const AREAS: readonly Area[] = ['formato', 'huella', 'cadena', 'xsd', 'qr', 'maquetacion']

/** `sin_datos`: no se aportó nada que comprobar en esa área (p. ej. ningún QR) */
export type EstadoArea = 'ok' | 'falla' | 'no_comprobado' | 'sin_datos'

/**
 * Veredicto global, en tres estados:
 * - `aprobado`: todo lo aportado se ha comprobado y no hay hallazgos críticos ni altos.
 * - `falla`: hay al menos un hallazgo crítico o alto.
 * - `no_comprobado`: no hay fallos, pero algo no se pudo comprobar (p. ej. el XSD).
 */
export type Veredicto = 'aprobado' | 'falla' | 'no_comprobado'

/** Área a la que pertenece una regla, por su prefijo (`XML-`, `FIC-`… no pertenecen a ninguna) */
export function areaDeRegla(regla: string): Area | null {
  const [pre, num] = regla.split('-')
  if (pre === 'HUE') return 'huella'
  if (pre === 'CAD' || pre === 'EVT') return 'cadena'
  if (pre === 'FMT') return 'formato'
  if (pre === 'XSD') return 'xsd'
  if (pre === 'QR') return Number(num) >= 10 ? 'maquetacion' : 'qr'
  return null
}
