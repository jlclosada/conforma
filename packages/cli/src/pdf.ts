import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { MaquetacionQr, TextoPagina } from '@conforma/core'
import { leerQrDeImagen, prepararZxing, readBarcodes } from './qrimagen.js'

const require = createRequire(import.meta.url)
const FUENTES = dirname(require.resolve('pdfjs-dist/package.json')) + '/standard_fonts/'
const PT_A_MM = 25.4 / 72
const DPI = 200
const ESCALA = DPI / 72
const PX_A_MM = 25.4 / DPI

export interface QrEnPdf {
  url: string
  nivelCorreccion: string
  maquetacion: MaquetacionQr
}

const esUrlAeat = (t: string) => /TIKE-CONT\/ValidarQR/i.test(t)

/**
 * Busca el QR tributario en las primeras páginas de un PDF: lo dibuja en memoria a 200 ppp,
 * lo decodifica, mide su tamaño y el margen libre y recoge los textos de la página.
 */
export async function analizarPdf(ruta: string, maxPaginas = 3): Promise<QrEnPdf | null> {
  await prepararZxing()
  const data = new Uint8Array(await readFile(ruta))
  const tarea = getDocument({ data, standardFontDataUrl: FUENTES, verbosity: 0 })
  const doc = await tarea.promise
  try {
    for (let n = 1; n <= Math.min(doc.numPages, maxPaginas); n++) {
      const page = await doc.getPage(n)
      const vp = page.getViewport({ scale: ESCALA })
      const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height))
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // pdf.js acepta el contexto 2D de @napi-rs/canvas
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: vp }).promise
      const png = await canvas.encode('png')
      const codigos = (await readBarcodes(new Uint8Array(png), { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 8 })).filter((c) => c.isValid)
      const tributario = codigos.find((c) => esUrlAeat(c.text))
      if (!tributario) continue

      const caja = (c: typeof tributario) => {
        const p = c.position
        const xs = [p.topLeft.x, p.topRight.x, p.bottomLeft.x, p.bottomRight.x]
        const ys = [p.topLeft.y, p.topRight.y, p.bottomLeft.y, p.bottomRight.y]
        return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
      }
      const b = caja(tributario)
      const esPrimerQr = n === 1 && !codigos.some((c) => c !== tributario && (caja(c).y1 < b.y0 || (Math.abs(caja(c).y0 - b.y0) < 5 && caja(c).x1 < b.x0)))

      // Margen libre: distancia (mm) al primer píxel oscuro fuera del símbolo, hasta 6 mm
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const oscuro = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= img.width || y >= img.height) return false
        const i = (Math.round(y) * img.width + Math.round(x)) * 4
        return 0.299 * img.data[i]! + 0.587 * img.data[i + 1]! + 0.114 * img.data[i + 2]! < 128
      }
      const limite = 6 / PX_A_MM
      let margen = 6
      for (let d = 1; d <= limite; d += 1) {
        let hay = false
        for (let x = b.x0 - d; x <= b.x1 + d && !hay; x += 1) hay = oscuro(x, b.y0 - d) || oscuro(x, b.y1 + d)
        for (let y = b.y0 - d; y <= b.y1 + d && !hay; y += 1) hay = oscuro(b.x0 - d, y) || oscuro(b.x1 + d, y)
        if (hay) { margen = d * PX_A_MM; break }
      }

      // Textos de la página en mm desde la esquina superior izquierda
      const vp1 = page.getViewport({ scale: 1 })
      const contenido = await page.getTextContent()
      const textos: TextoPagina[] = []
      for (const it of contenido.items) {
        if (!('str' in it) || !it.str.trim()) continue
        const [, , c, d, e, f] = it.transform as number[]
        const tamano = Math.hypot(c!, d!) || it.height
        const [vx, vy] = vp1.convertToViewportPoint(e!, f!)
        textos.push({ texto: it.str, tamano, x: vx! * PT_A_MM, y: (vy! - tamano) * PT_A_MM, ancho: it.width * PT_A_MM, alto: tamano * PT_A_MM })
      }

      return {
        url: tributario.text,
        nivelCorreccion: String(tributario.ecLevel ?? ''),
        maquetacion: {
          pagina: { numero: n, ancho: vp1.width * PT_A_MM, alto: vp1.height * PT_A_MM },
          qr: { x: b.x0 * PX_A_MM, y: b.y0 * PX_A_MM, ancho: (b.x1 - b.x0) * PX_A_MM, alto: (b.y1 - b.y0) * PX_A_MM },
          esPrimerQr,
          margenLibre: margen,
          textos,
          verifactu: /\/ValidarQR(\?|$)/.test(tributario.text),
        },
      }
    }
    return null
  } finally {
    await tarea.destroy()
  }
}
export { leerQrDeImagen }
