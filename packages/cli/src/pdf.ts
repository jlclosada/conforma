import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { maquetacionDesdePagina, type QrEnPagina, type TextoPdf } from '@conforma/core'
import { prepararZxing, readBarcodes } from './qrimagen.js'

const require = createRequire(import.meta.url)
const FUENTES = dirname(require.resolve('pdfjs-dist/package.json')) + '/standard_fonts/'
const ESCALA = 200 / 72 // 200 ppp

/** Busca el QR tributario en las primeras páginas de un PDF: dibuja, decodifica y mide. */
export async function analizarPdf(ruta: string, maxPaginas = 3): Promise<QrEnPagina | null> {
  await prepararZxing()
  const tarea = getDocument({ data: new Uint8Array(await readFile(ruta)), standardFontDataUrl: FUENTES, verbosity: 0 })
  const doc = await tarea.promise
  try {
    for (let n = 1; n <= Math.min(doc.numPages, maxPaginas); n++) {
      const page = await doc.getPage(n)
      const vp = page.getViewport({ scale: ESCALA })
      const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height))
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: vp }).promise
      const leidos = (await readBarcodes(new Uint8Array(await canvas.encode('png')), { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 8 })).filter((c) => c.isValid)
      const vp1 = page.getViewport({ scale: 1 })
      const contenido = await page.getTextContent()
      const res = maquetacionDesdePagina({
        numero: n, anchoPt: vp1.width, altoPt: vp1.height, escala: ESCALA,
        pixeles: ctx.getImageData(0, 0, canvas.width, canvas.height),
        codigos: leidos.map((c) => ({ texto: c.text, nivelCorreccion: String(c.ecLevel ?? ''), esquinas: [c.position.topLeft, c.position.topRight, c.position.bottomLeft, c.position.bottomRight] })),
        textos: contenido.items.filter((it): it is TextoPdf & typeof it => 'str' in it) as TextoPdf[],
        aPagina: (x, y) => vp1.convertToViewportPoint(x, y) as [number, number],
      })
      if (res) return res
    }
    return null
  } finally {
    await tarea.destroy()
  }
}
