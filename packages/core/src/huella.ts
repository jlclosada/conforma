import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'
import type { RegistroAlta, RegistroAnulacion, RegistroEvento } from './registros.js'

/**
 * Huella según «Detalle de las especificaciones técnicas para generación de la huella o hash
 * de los registros de facturación» (AEAT, v0.1.2, 27/08/2024):
 * campos en orden fijo como `campo=valor&…`, valores sin espacios al inicio y al final,
 * SHA-256 sobre la cadena en UTF-8 y resultado en hexadecimal en mayúsculas (64 caracteres).
 */
export const DOC_HUELLA = 'AEAT · Especificaciones de la huella o hash v0.1.2'

export const CAMPOS_ALTA = ['IDEmisorFactura', 'NumSerieFactura', 'FechaExpedicionFactura', 'TipoFactura', 'CuotaTotal', 'ImporteTotal', 'Huella', 'FechaHoraHusoGenRegistro'] as const
export const CAMPOS_ANULACION = ['IDEmisorFacturaAnulada', 'NumSerieFacturaAnulada', 'FechaExpedicionFacturaAnulada', 'Huella', 'FechaHoraHusoGenRegistro'] as const
export const CAMPOS_EVENTO = ['NIF', 'ID', 'IdSistemaInformatico', 'Version', 'NumeroInstalacion', 'NIF', 'TipoEvento', 'HuellaEvento', 'FechaHoraHusoGenEvento'] as const

const v = (x: string | undefined) => (x ?? '').trim()
const unir = (pares: [string, string | undefined][]) => pares.map(([k, val]) => `${k}=${v(val)}`).join('&')

export function calcularHuella(cadena: string): string {
  return bytesToHex(sha256(utf8ToBytes(cadena))).toUpperCase()
}

export function cadenaAlta(r: Pick<RegistroAlta, 'idEmisor' | 'numSerie' | 'fechaExpedicion' | 'tipoFactura' | 'cuotaTotal' | 'importeTotal' | 'fechaHoraGen' | 'encadenamiento'>, importes?: { cuota: string; importe: string }): string {
  return unir([
    ['IDEmisorFactura', r.idEmisor],
    ['NumSerieFactura', r.numSerie],
    ['FechaExpedicionFactura', r.fechaExpedicion],
    ['TipoFactura', r.tipoFactura],
    ['CuotaTotal', importes?.cuota ?? r.cuotaTotal],
    ['ImporteTotal', importes?.importe ?? r.importeTotal],
    ['Huella', r.encadenamiento.primero ? '' : r.encadenamiento.anterior?.huella],
    ['FechaHoraHusoGenRegistro', r.fechaHoraGen],
  ])
}

export function cadenaAnulacion(r: Pick<RegistroAnulacion, 'idEmisor' | 'numSerie' | 'fechaExpedicion' | 'fechaHoraGen' | 'encadenamiento'>): string {
  return unir([
    ['IDEmisorFacturaAnulada', r.idEmisor],
    ['NumSerieFacturaAnulada', r.numSerie],
    ['FechaExpedicionFacturaAnulada', r.fechaExpedicion],
    ['Huella', r.encadenamiento.primero ? '' : r.encadenamiento.anterior?.huella],
    ['FechaHoraHusoGenRegistro', r.fechaHoraGen],
  ])
}

export function cadenaEvento(r: Pick<RegistroEvento, 'sistemaNif' | 'sistemaIdOtro' | 'idSistema' | 'version' | 'numeroInstalacion' | 'obligadoNif' | 'tipoEvento' | 'primero' | 'huellaAnterior' | 'fechaHoraGen'>): string {
  return unir([
    ['NIF', r.sistemaNif],
    ['ID', r.sistemaIdOtro],
    ['IdSistemaInformatico', r.idSistema],
    ['Version', r.version],
    ['NumeroInstalacion', r.numeroInstalacion],
    ['NIF', r.obligadoNif],
    ['TipoEvento', r.tipoEvento],
    ['HuellaEvento', r.primero ? '' : r.huellaAnterior],
    ['FechaHoraHusoGenEvento', r.fechaHoraGen],
  ])
}

/**
 * La AEAT trata igual los importes con uno o dos decimales («sin tener relevancia los ceros a la
 * derecha»). Devuelve las representaciones equivalentes de un importe, empezando por la original.
 */
export function variantesImporte(valor: string): string[] {
  const t = v(valor)
  const m = /^([+-]?\d+)(?:\.(\d{0,2}))?$/.exec(t)
  if (!m) return [t]
  const [, ent, dec = ''] = m
  const out = new Set<string>([t])
  const d2 = dec.padEnd(2, '0')
  out.add(`${ent}.${d2}`)
  if (d2.endsWith('0')) out.add(`${ent}.${d2[0]}`)
  if (d2 === '00') out.add(ent!)
  return [...out]
}

export interface ResultadoHuella {
  coincide: boolean
  /** Huella calculada con los valores tal y como aparecen */
  calculada: string
  cadena: string
  /** Si solo coincide usando otra representación equivalente de los importes */
  varianteImportes?: { cuota: string; importe: string }
}

export function verificarHuellaAlta(r: RegistroAlta): ResultadoHuella {
  const cadena = cadenaAlta(r)
  const calculada = calcularHuella(cadena)
  const informada = v(r.huella)
  if (calculada === informada) return { coincide: true, calculada, cadena }
  for (const cuota of variantesImporte(r.cuotaTotal)) {
    for (const importe of variantesImporte(r.importeTotal)) {
      const c = cadenaAlta(r, { cuota, importe })
      if (calcularHuella(c) === informada) return { coincide: true, calculada, cadena, varianteImportes: { cuota, importe } }
    }
  }
  return { coincide: false, calculada, cadena }
}

export function verificarHuellaAnulacion(r: RegistroAnulacion): ResultadoHuella {
  const cadena = cadenaAnulacion(r)
  const calculada = calcularHuella(cadena)
  return { coincide: calculada === v(r.huella), calculada, cadena }
}

export function verificarHuellaEvento(r: RegistroEvento): ResultadoHuella {
  const cadena = cadenaEvento(r)
  const calculada = calcularHuella(cadena)
  return { coincide: calculada === v(r.huella), calculada, cadena }
}
