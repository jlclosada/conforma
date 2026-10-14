import { validarNif } from '../nif.js'
import type { Registro } from '../registros.js'
import type { Hallazgo } from '../tipos.js'
import { ref } from './huella.js'

const XSD = 'Esquema SuministroInformacion.xsd (AEAT)'
const TIPOS_FACTURA = ['F1', 'F2', 'F3', 'R1', 'R2', 'R3', 'R4', 'R5']
const RE_IMPORTE = /^(\+|-)?\d{1,12}(\.\d{0,2})?$/
const RE_FECHA = /^(\d{2})-(\d{2})-(\d{4})$/
const RE_FECHA_HORA_HUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

export function fechaValida(f: string) {
  const m = RE_FECHA.exec(f.trim())
  if (!m) return false
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

/** Caracteres imprimibles ASCII 32–126 (necesario para el QR) */
export const asciiImprimible = (s: string) => /^[\x20-\x7E]*$/.test(s)

export function reglasFormato(r: Registro): Hallazgo[] {
  const out: Hallazgo[] = []
  const add = (h: Omit<Hallazgo, 'registro'>) => out.push({ ...h, registro: ref(r) })

  if (r.tipo === 'evento') {
    if (!RE_FECHA_HORA_HUSO.test(r.fechaHoraGen.trim())) add({ regla: 'FMT-006', severidad: 'alta', mensaje: 'FechaHoraHusoGenEvento debe incluir fecha, hora y huso horario', obtenido: r.fechaHoraGen, esperado: 'AAAA-MM-DDThh:mm:ss+hh:mm' })
    return out
  }

  const nif = validarNif(r.idEmisor)
  if (!nif.valido) add({ regla: 'FMT-001', severidad: 'alta', mensaje: `NIF del emisor no válido: ${nif.motivo}`, obtenido: r.idEmisor })

  const ns = r.numSerie
  if (!ns.trim()) add({ regla: 'FMT-002', severidad: 'critica', mensaje: 'Falta el número de serie de la factura' })
  else {
    if (ns.trim().length > 60) add({ regla: 'FMT-002', severidad: 'alta', mensaje: 'El número de serie supera 60 caracteres', obtenido: String(ns.trim().length), referencia: XSD })
    if (!asciiImprimible(ns.trim())) add({ regla: 'FMT-003', severidad: 'alta', mensaje: 'El número de serie contiene caracteres fuera de ASCII 32–126; el cotejo del QR lo rechazará (error 2003)', obtenido: ns, referencia: 'AEAT · Especificaciones del código QR v0.5.0, apartado 6' })
    if (ns !== ns.trim()) add({ regla: 'FMT-004', severidad: 'info', mensaje: 'El número de serie tiene espacios al principio o al final (se ignoran en la huella, pero conviene evitarlos)' })
  }

  if (!fechaValida(r.fechaExpedicion)) add({ regla: 'FMT-005', severidad: 'alta', mensaje: 'Fecha de expedición no válida', esperado: 'DD-MM-AAAA', obtenido: r.fechaExpedicion, referencia: XSD })
  if (!RE_FECHA_HORA_HUSO.test(r.fechaHoraGen.trim())) add({ regla: 'FMT-006', severidad: 'alta', mensaje: 'FechaHoraHusoGenRegistro debe incluir fecha, hora y huso horario', esperado: 'AAAA-MM-DDThh:mm:ss+hh:mm', obtenido: r.fechaHoraGen })

  if (r.tipo === 'alta') {
    if (!TIPOS_FACTURA.includes(r.tipoFactura.trim())) add({ regla: 'FMT-007', severidad: 'alta', mensaje: `TipoFactura no válido (admitidos: ${TIPOS_FACTURA.join(', ')})`, obtenido: r.tipoFactura, referencia: XSD })
    for (const [campo, val] of [['CuotaTotal', r.cuotaTotal], ['ImporteTotal', r.importeTotal]] as const) {
      if (!RE_IMPORTE.test(val.trim())) add({ regla: 'FMT-008', severidad: 'alta', mensaje: `${campo} no tiene un formato de importe válido (hasta 12 enteros y 2 decimales, punto decimal)`, obtenido: val, referencia: XSD })
    }
  }
  return out
}
