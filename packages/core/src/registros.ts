import type { TipoRegistro } from './tipos.js'

/** Datos del registro anterior tal y como figuran en `Encadenamiento/RegistroAnterior` */
export interface RegistroAnteriorRef {
  idEmisor?: string
  numSerie?: string
  fechaExpedicion?: string
  huella?: string
}

export interface Encadenamiento {
  /** `PrimerRegistro = S` */
  primero: boolean
  anterior?: RegistroAnteriorRef
}

interface Base {
  tipo: TipoRegistro
  /** Posición en el lote */
  indice: number
  fichero?: string
  tipoHuella?: string
  huella?: string
}

export interface RegistroAlta extends Base {
  tipo: 'alta'
  idEmisor: string
  numSerie: string
  fechaExpedicion: string
  tipoFactura: string
  cuotaTotal: string
  importeTotal: string
  fechaHoraGen: string
  nombreEmisor?: string
  subsanacion?: string
  rechazoPrevio?: string
  encadenamiento: Encadenamiento
}

export interface RegistroAnulacion extends Base {
  tipo: 'anulacion'
  idEmisor: string
  numSerie: string
  fechaExpedicion: string
  fechaHoraGen: string
  encadenamiento: Encadenamiento
}

export interface RegistroEvento extends Base {
  tipo: 'evento'
  sistemaNif: string
  sistemaIdOtro: string
  idSistema: string
  version: string
  numeroInstalacion: string
  obligadoNif: string
  tipoEvento: string
  fechaHoraGen: string
  primero: boolean
  huellaAnterior?: string
}

export type RegistroFacturacion = RegistroAlta | RegistroAnulacion
export type Registro = RegistroFacturacion | RegistroEvento

export const etiqueta = (r: Registro) => (r.tipo === 'evento' ? `evento ${r.tipoEvento}` : r.numSerie.trim())
