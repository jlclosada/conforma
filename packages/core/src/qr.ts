import { validarNif } from './nif.js'
import type { RegistroAlta } from './registros.js'
import { asciiImprimible, fechaValida } from './rules/formato.js'
import type { Hallazgo } from './tipos.js'

/**
 * Comprobaciones de la URL del código QR según «Detalle de las especificaciones técnicas del
 * código QR de la factura y de la URL del servicio de cotejo» (AEAT, v0.5.0, 10/12/2025).
 */
export const DOC_QR = 'AEAT · Especificaciones del código QR v0.5.0'

export const BASES_QR = {
  'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR': { entorno: 'pruebas', verificable: true },
  'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu': { entorno: 'pruebas', verificable: false },
  'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR': { entorno: 'produccion', verificable: true },
  'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu': { entorno: 'produccion', verificable: false },
} as const

const PARAMS = ['nif', 'numserie', 'fecha', 'importe'] as const
const RE_IMPORTE_QR = /^-?\d{1,12}(\.\d{1,2})?$/

export interface UrlQr {
  base: string
  entorno?: 'pruebas' | 'produccion'
  verificable?: boolean
  nif?: string
  numserie?: string
  fecha?: string
  importe?: string
}

export interface OpcionesQr {
  /** Registro de alta con el que debe cuadrar el QR */
  registro?: RegistroAlta
  /** Entorno esperado; por defecto no se comprueba */
  entorno?: 'pruebas' | 'produccion'
}

const numero = (s: string) => Number(s.trim())

export function analizarUrlQr(url: string, opciones: OpcionesQr = {}): { qr: UrlQr; hallazgos: Hallazgo[] } {
  const hallazgos: Hallazgo[] = []
  const add = (regla: string, severidad: Hallazgo['severidad'], mensaje: string, extra: Partial<Hallazgo> = {}) =>
    hallazgos.push({ regla, severidad, mensaje, referencia: DOC_QR, ...extra })

  const [baseRaw = '', queryRaw = ''] = url.trim().split(/\?(.*)/s)
  const base = baseRaw
  const meta = (BASES_QR as Record<string, { entorno: 'pruebas' | 'produccion'; verificable: boolean }>)[base]
  const qr: UrlQr = { base, entorno: meta?.entorno, verificable: meta?.verificable }

  if (!meta) add('QR-001', 'critica', 'La URL no apunta a ningún servicio de cotejo de la AEAT', { obtenido: base, esperado: Object.keys(BASES_QR).join(' | ') })
  else if (opciones.entorno && meta.entorno !== opciones.entorno) add('QR-001', 'alta', `La URL es del entorno de ${meta.entorno} y se esperaba ${opciones.entorno}`, { obtenido: base })

  if (!asciiImprimible(url)) add('QR-007', 'alta', 'La URL contiene caracteres sin codificar fuera de ASCII imprimible; hay que aplicar «URL encoding» en UTF-8', { referencia: `${DOC_QR}, apartado 4` })

  // Parseo manual para detectar parámetros mal codificados (p. ej. un «&» sin codificar en numserie)
  const crudos = queryRaw.split('&').filter(Boolean).map((p) => {
    const i = p.indexOf('=')
    return i < 0 ? { k: p, v: undefined } : { k: p.slice(0, i), v: p.slice(i + 1) }
  })
  const valores = new Map<string, string>()
  for (const { k, v } of crudos) {
    let dec: string | undefined
    try { dec = v === undefined ? undefined : decodeURIComponent(v.replace(/\+/g, ' ')) } catch { add('QR-007', 'alta', `El parámetro «${k}» tiene una codificación inválida`, { obtenido: v }) }
    if ((PARAMS as readonly string[]).includes(k)) {
      if (valores.has(k)) add('QR-002', 'alta', `El parámetro «${k}» aparece repetido`)
      valores.set(k, dec ?? '')
    } else if (k === 'formato') add('QR-002', 'alta', 'La URL del QR nunca puede incluir el parámetro «formato» (solo para consultas automáticas)', { referencia: `${DOC_QR}, apartado 7` })
    else if (k === 'idioma') add('QR-002', 'media', 'La URL del QR debe llevar únicamente los 4 parámetros obligatorios; «idioma» es opcional del servicio, no del QR', { referencia: `${DOC_QR}, apartados 6 y 7` })
    else add('QR-003', 'alta', `Parámetro desconocido «${k}». Si forma parte del número de serie, falta codificar el «&» como %26`, { obtenido: `${k}${v !== undefined ? `=${v}` : ''}`, referencia: `${DOC_QR}, apartado 4` })
  }
  if (/[ #]/.test(queryRaw)) add('QR-007', 'media', 'Hay espacios o «#» sin codificar en los parámetros', { referencia: `${DOC_QR}, apartado 4` })

  const codigos: Record<string, string> = { nif: '1001', numserie: '1002', fecha: '1003', importe: '1004' }
  for (const p of PARAMS) if (!valores.get(p)) add('QR-004', 'critica', `Falta el parámetro «${p}» (la AEAT respondería con el error ${codigos[p]})`)

  const nif = valores.get('nif'), numserie = valores.get('numserie'), fecha = valores.get('fecha'), importe = valores.get('importe')
  Object.assign(qr, { nif, numserie, fecha, importe })

  if (nif && !validarNif(nif).valido) add('QR-005', 'alta', 'NIF con formato erróneo o no válido (error 2001)', { obtenido: nif })
  if (numserie) {
    if (numserie.length > 60) add('QR-005', 'alta', 'El número de serie supera 60 caracteres (error 2002)', { obtenido: String(numserie.length) })
    if (!asciiImprimible(numserie)) add('QR-005', 'alta', 'El número de serie contiene caracteres no permitidos (error 2003)', { obtenido: numserie })
  }
  if (fecha && !fechaValida(fecha)) add('QR-005', 'alta', 'Fecha con formato inválido, debe ser DD-MM-AAAA (error 2004)', { obtenido: fecha })
  if (importe) {
    if (/,/.test(importe)) add('QR-005', 'alta', 'El importe usa coma decimal; debe usarse punto (error 2005)', { obtenido: importe })
    else if (!RE_IMPORTE_QR.test(importe)) add('QR-005', 'alta', /^\-?\d{13,}/.test(importe) ? 'El importe excede el número máximo de caracteres (error 2006)' : 'El importe tiene un formato incorrecto (error 2005)', { obtenido: importe })
  }

  const r = opciones.registro
  if (r) {
    const dif: [string, string | undefined, string][] = [
      ['nif', nif, r.idEmisor.trim()],
      ['numserie', numserie, r.numSerie.trim()],
      ['fecha', fecha, r.fechaExpedicion.trim()],
    ]
    for (const [k, qv, rv] of dif) if (qv !== undefined && qv !== rv) add('QR-006', 'critica', `El parámetro «${k}» del QR no coincide con el registro de facturación`, { esperado: rv, obtenido: qv })
    if (importe && RE_IMPORTE_QR.test(importe) && numero(importe) !== numero(r.importeTotal)) add('QR-006', 'critica', 'El importe del QR no coincide con el ImporteTotal del registro', { esperado: r.importeTotal.trim(), obtenido: importe })
  }
  return { qr, hallazgos }
}

/** Construye la URL del QR de una factura, con la codificación correcta */
export function construirUrlQr(datos: { nif: string; numserie: string; fecha: string; importe: string }, base: keyof typeof BASES_QR = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR'): string {
  const q = PARAMS.map((p) => `${p}=${encodeURIComponent(datos[p].trim())}`).join('&')
  return `${base}?${q}`
}
