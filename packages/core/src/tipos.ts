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
}

export const FALLA: ReadonlySet<Severidad> = new Set(['critica', 'alta'])
