import {
  analizarMaquetacionQr, analizarUrlQr, etiqueta, leerXml, maquetacionDesdePagina, verificar,
  type Area, type Hallazgo, type Informe, type MaquetacionQr, type Registro, type RegistroAlta, type TextoPdf,
} from '@conforma/core'
import { validarXsdConEsquemas, type FicheroEsquema } from '@conforma/core/xsd-esquemas'
import suministroLR from '@conforma/core/schemas/SuministroLR.xsd?raw'
import suministroInfo from '@conforma/core/schemas/SuministroInformacion.xsd?raw'
import eventos from '@conforma/core/schemas/EventosSIF.xsd?raw'
import dsig from '@conforma/core/schemas/xmldsig-core-schema.xsd?raw'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import zxingWasm from 'zxing-wasm/reader/zxing_reader.wasm?url'
import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Todo se carga desde la propia web: nada de CDN, nada sale del navegador.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker
prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? zxingWasm : prefix + path) } })

const ESQUEMAS: FicheroEsquema[] = [
  { fileName: 'SuministroLR.xsd', contents: suministroLR },
  { fileName: 'SuministroInformacion.xsd', contents: suministroInfo },
  { fileName: 'EventosSIF.xsd', contents: eventos },
  { fileName: 'xmldsig-core-schema.xsd', contents: dsig },
]

export interface QrAnalizado {
  fuente: string
  url: string
  nivelCorreccion?: string
  maquetacion?: MaquetacionQr
  /** Miniatura de la página (JPEG en data URL), solo en memoria */
  miniatura?: string
}

/** Lo justo de cada registro para dibujar la cadena de huellas */
export interface Eslabon {
  indice: number
  tipo: Registro['tipo']
  etiqueta: string
  fecha?: string
  importe?: string
  huella?: string
  anterior?: string
  primero: boolean
  fichero?: string
}

/** Huella SHA-256 de cada fichero analizado: identifica sin ambigüedad qué se verificó */
export interface Evidencia { nombre: string; bytes: number; sha256: string }

export interface Resultado {
  informe: Informe
  ficheros: Evidencia[]
  qrs: QrAnalizado[]
  cadena: Eslabon[]
  milisegundos: number
}

const eslabon = (r: Registro): Eslabon => ({
  indice: r.indice,
  tipo: r.tipo,
  etiqueta: etiqueta(r),
  fecha: r.tipo === 'evento' ? r.fechaHoraGen : r.fechaExpedicion,
  importe: r.tipo === 'alta' ? r.importeTotal : undefined,
  huella: r.huella,
  anterior: r.tipo === 'evento' ? r.huellaAnterior : r.encadenamiento.anterior?.huella,
  primero: r.tipo === 'evento' ? r.primero : r.encadenamiento.primero,
  fichero: r.fichero,
})

const ESCALA = 200 / 72

async function evidencia(f: File): Promise<Evidencia> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', await f.arrayBuffer()))
  return { nombre: f.name, bytes: f.size, sha256: [...hash].map((b) => b.toString(16).padStart(2, '0')).join('') }
}

async function qrDePdf(file: File): Promise<{ url: string; nivelCorreccion: string; maquetacion: MaquetacionQr; miniatura: string } | null> {
  const tarea = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), standardFontDataUrl: './standard_fonts/', verbosity: 0 })
  const doc = await tarea.promise
  try {
    for (let n = 1; n <= Math.min(doc.numPages, 3); n++) {
      const page = await doc.getPage(n)
      const vp = page.getViewport({ scale: ESCALA })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(vp.width)
      canvas.height = Math.ceil(vp.height)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
      const pixeles = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const leidos = (await readBarcodes(pixeles, { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 8 })).filter((c) => c.isValid)
      const vp1 = page.getViewport({ scale: 1 })
      const contenido = await page.getTextContent()
      const res = maquetacionDesdePagina({
        numero: n, anchoPt: vp1.width, altoPt: vp1.height, escala: ESCALA, pixeles,
        codigos: leidos.map((c) => ({ texto: c.text, nivelCorreccion: String(c.ecLevel ?? ''), esquinas: [c.position.topLeft, c.position.topRight, c.position.bottomLeft, c.position.bottomRight] })),
        textos: contenido.items.filter((it) => 'str' in it) as TextoPdf[],
        aPagina: (x, y) => vp1.convertToViewportPoint(x, y) as [number, number],
      })
      if (res) {
        const mini = document.createElement('canvas')
        mini.width = Math.round(canvas.width / 3)
        mini.height = Math.round(canvas.height / 3)
        mini.getContext('2d')!.drawImage(canvas, 0, 0, mini.width, mini.height)
        return { ...res, miniatura: mini.toDataURL('image/jpeg', 0.82) }
      }
    }
    return null
  } finally {
    await tarea.destroy()
  }
}

async function qrDeImagen(file: File) {
  const res = await readBarcodes(file, { formats: ['QRCode'], tryHarder: true })
  return res.filter((r) => r.isValid).map((r) => ({ url: r.text, nivelCorreccion: String(r.ecLevel ?? '') }))
}

/** Mismo flujo que la CLI: XML → registros + XSD; PDF/imagen/URL → QR; y verificación conjunta */
export async function analizar(ficheros: File[], urlsQr: string[]): Promise<Resultado> {
  const t0 = performance.now()
  const comprobadas = new Set<Area>()
  const registros: Registro[] = []
  const extra: Hallazgo[] = []
  const qrs: QrAnalizado[] = []
  const nombres: Evidencia[] = []

  const xmls = ficheros.filter((f) => /\.xml$/i.test(f.name))
  const otros = ficheros.filter((f) => !/\.xml$/i.test(f.name))

  for (const f of xmls) {
    nombres.push(await evidencia(f))
    const xml = await f.text()
    let lectura
    try { lectura = leerXml(xml, { fichero: f.name, indiceInicial: registros.length }) } catch (e) {
      extra.push({ regla: 'XML-001', severidad: 'critica', mensaje: `${f.name} no es un XML válido: ${(e as Error).message}` })
      continue
    }
    if (!lectura.registros.length) extra.push({ regla: 'XML-002', severidad: 'media', mensaje: `${f.name} no contiene registros de alta, anulación ni evento` })
    registros.push(...lectura.registros)
    comprobadas.add('xsd')
    try { extra.push(...(await validarXsdConEsquemas(xml, lectura.raiz, ESQUEMAS, f.name))) } catch (e) {
      extra.push({ regla: 'XSD-000', severidad: 'media', noComprobado: true, mensaje: `No se pudo validar ${f.name} contra el XSD: ${(e as Error).message}` })
    }
  }

  for (const f of otros) {
    nombres.push(await evidencia(f))
    if (/\.pdf$/i.test(f.name)) {
      const res = await qrDePdf(f)
      if (!res) { extra.push({ regla: 'QR-000', severidad: 'critica', mensaje: `No se ha encontrado el QR tributario en las primeras páginas de ${f.name}` }); continue }
      qrs.push({ fuente: f.name, ...res })
      comprobadas.add('maquetacion')
      for (const h of analizarMaquetacionQr(res.maquetacion)) extra.push({ ...h, mensaje: `[${f.name}] ${h.mensaje}` })
    } else if (/\.(png|jpe?g|webp)$/i.test(f.name)) {
      const leidos = await qrDeImagen(f)
      if (!leidos.length) { extra.push({ regla: 'QR-000', severidad: 'alta', mensaje: `No se ha encontrado ningún código QR legible en ${f.name}` }); continue }
      for (const l of leidos) qrs.push({ fuente: f.name, ...l })
    } else {
      extra.push({ regla: 'FIC-001', severidad: 'info', mensaje: `${f.name}: tipo de fichero no admitido (XML, PDF, PNG, JPG)` })
    }
  }
  for (const u of urlsQr.map((x) => x.trim()).filter(Boolean)) qrs.push({ fuente: 'URL pegada', url: u })

  if (qrs.length) comprobadas.add('qr')
  for (const q of qrs) {
    if (q.nivelCorreccion && q.nivelCorreccion !== 'M') extra.push({ regla: 'QR-008', severidad: 'alta', mensaje: `[${q.fuente}] El QR usa el nivel de corrección ${q.nivelCorreccion}; la orden exige el nivel M`, referencia: 'Orden HAC/1177/2024, art. 21.1' })
    const numserie = new URLSearchParams(q.url.split('?')[1] ?? '').get('numserie')?.trim()
    const registro = registros.find((r): r is RegistroAlta => r.tipo === 'alta' && r.numSerie.trim() === numserie)
    for (const h of analizarUrlQr(q.url, { registro }).hallazgos) extra.push({ ...h, mensaje: `[QR ${numserie ?? q.fuente}] ${h.mensaje}` })
    if (numserie && registros.length && !registro) extra.push({ regla: 'QR-009', severidad: 'media', noComprobado: true, mensaje: `[QR ${numserie}] No hay ningún registro de alta con ese número de serie: no se ha comprobado la coherencia` })
  }

  const informe = verificar(registros, extra, { comprobadas: [...comprobadas] })
  return { informe, ficheros: nombres, qrs, cadena: registros.map(eslabon), milisegundos: Math.round(performance.now() - t0) }
}
