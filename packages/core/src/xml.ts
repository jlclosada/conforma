import { XMLParser } from 'fast-xml-parser'
import type { Registro, RegistroAlta, RegistroAnulacion, RegistroEvento, Encadenamiento } from './registros.js'

type Nodo = Record<string, unknown>

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: false,
  processEntities: true,
  // Sin entidades externas: fast-xml-parser no resuelve DTD ni XXE
  isArray: (name) => ['RegistroFactura', 'RegistroAlta', 'RegistroAnulacion', 'RegistroEvento'].includes(name),
})

const texto = (n: unknown): string | undefined => {
  if (n === undefined || n === null) return undefined
  if (typeof n === 'string') return n
  if (typeof n === 'number' || typeof n === 'boolean') return String(n)
  if (typeof n === 'object' && '#text' in (n as Nodo)) return String((n as Nodo)['#text'])
  return undefined
}

function get(n: unknown, ruta: string): unknown {
  let cur: unknown = n
  for (const k of ruta.split('.')) {
    if (cur === undefined || cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Nodo)[k]
    if (Array.isArray(cur)) cur = cur[0]
  }
  return cur
}
const s = (n: unknown, ruta: string) => texto(get(n, ruta))

function encadenamiento(n: unknown): Encadenamiento {
  const primero = (s(n, 'Encadenamiento.PrimerRegistro') ?? '').trim().toUpperCase() === 'S'
  const ant = get(n, 'Encadenamiento.RegistroAnterior')
  return {
    primero,
    anterior: ant ? {
      idEmisor: s(ant, 'IDEmisorFactura'),
      numSerie: s(ant, 'NumSerieFactura'),
      fechaExpedicion: s(ant, 'FechaExpedicionFactura'),
      huella: s(ant, 'Huella'),
    } : undefined,
  }
}

function alta(n: unknown, indice: number, fichero?: string): RegistroAlta {
  return {
    tipo: 'alta', indice, fichero,
    idEmisor: s(n, 'IDFactura.IDEmisorFactura') ?? '',
    numSerie: s(n, 'IDFactura.NumSerieFactura') ?? '',
    fechaExpedicion: s(n, 'IDFactura.FechaExpedicionFactura') ?? '',
    tipoFactura: s(n, 'TipoFactura') ?? '',
    cuotaTotal: s(n, 'CuotaTotal') ?? '',
    importeTotal: s(n, 'ImporteTotal') ?? '',
    fechaHoraGen: s(n, 'FechaHoraHusoGenRegistro') ?? '',
    nombreEmisor: s(n, 'NombreRazonEmisor'),
    subsanacion: s(n, 'Subsanacion'),
    rechazoPrevio: s(n, 'RechazoPrevio'),
    tipoHuella: s(n, 'TipoHuella'),
    huella: s(n, 'Huella'),
    encadenamiento: encadenamiento(n),
  }
}

function anulacion(n: unknown, indice: number, fichero?: string): RegistroAnulacion {
  return {
    tipo: 'anulacion', indice, fichero,
    idEmisor: s(n, 'IDFactura.IDEmisorFacturaAnulada') ?? '',
    numSerie: s(n, 'IDFactura.NumSerieFacturaAnulada') ?? '',
    fechaExpedicion: s(n, 'IDFactura.FechaExpedicionFacturaAnulada') ?? '',
    fechaHoraGen: s(n, 'FechaHoraHusoGenRegistro') ?? '',
    tipoHuella: s(n, 'TipoHuella'),
    huella: s(n, 'Huella'),
    encadenamiento: encadenamiento(n),
  }
}

function evento(n: unknown, indice: number, fichero?: string): RegistroEvento {
  const e = get(n, 'Evento')
  return {
    tipo: 'evento', indice, fichero,
    sistemaNif: s(e, 'SistemaInformatico.NIF') ?? '',
    sistemaIdOtro: s(e, 'SistemaInformatico.IDOtro.ID') ?? '',
    idSistema: s(e, 'SistemaInformatico.IdSistemaInformatico') ?? '',
    version: s(e, 'SistemaInformatico.Version') ?? '',
    numeroInstalacion: s(e, 'SistemaInformatico.NumeroInstalacion') ?? '',
    obligadoNif: s(e, 'ObligadoEmision.NIF') ?? '',
    tipoEvento: s(e, 'TipoEvento') ?? '',
    fechaHoraGen: s(e, 'FechaHoraHusoGenEvento') ?? '',
    primero: (s(e, 'Encadenamiento.PrimerEvento') ?? '').trim().toUpperCase() === 'S',
    huellaAnterior: s(e, 'Encadenamiento.EventoAnterior.HuellaEvento'),
    tipoHuella: s(e, 'TipoHuella'),
    huella: s(e, 'HuellaEvento'),
  }
}

export interface Lectura {
  registros: Registro[]
  /** Elemento raíz del documento (sin prefijo) */
  raiz?: string
}

/**
 * Extrae en orden de aparición los registros de alta, anulación y evento de un XML:
 * un envío `RegFactuSistemaFacturacion`, un sobre SOAP, una exportación o registros sueltos.
 */
export function leerXml(xml: string, opciones: { fichero?: string; indiceInicial?: number } = {}): Lectura {
  const doc = parser.parse(xml) as Nodo
  const registros: Registro[] = []
  let i = opciones.indiceInicial ?? 0
  const visitar = (n: unknown) => {
    if (Array.isArray(n)) { n.forEach(visitar); return }
    if (!n || typeof n !== 'object') return
    for (const [k, val] of Object.entries(n as Nodo)) {
      if (k === '#text' || k === '?xml') continue
      if (k === 'RegistroAlta') for (const r of val as unknown[]) registros.push(alta(r, i++, opciones.fichero))
      else if (k === 'RegistroAnulacion') for (const r of val as unknown[]) registros.push(anulacion(r, i++, opciones.fichero))
      else if (k === 'RegistroEvento') for (const r of val as unknown[]) registros.push(evento(r, i++, opciones.fichero))
      else visitar(val)
    }
  }
  visitar(doc)
  const raiz = Object.keys(doc).find((k) => k !== '?xml' && k !== '#text')
  return { registros, raiz }
}
