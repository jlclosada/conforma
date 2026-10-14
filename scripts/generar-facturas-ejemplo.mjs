// Genera facturas PDF de ejemplo (correcta e incorrecta) para probar la lectura del QR.
// Uso: node scripts/generar-facturas-ejemplo.mjs   (requiere `pnpm install`)
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../packages/cli/package.json', import.meta.url))
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const { prepareZXingModule, writeBarcode } = await import(require.resolve('zxing-wasm/writer'))
const wasm = await readFile(require.resolve('zxing-wasm/writer/zxing_writer.wasm'))
await prepareZXingModule({ overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) }, fireImmediately: true })

const MM = 72 / 25.4
const A4 = [210 * MM, 297 * MM]

async function qrPng(url, ecLevel) {
  const r = await writeBarcode(url, { format: 'QRCode', ecLevel, scale: 8, addQuietZones: false })
  if (r.error) throw new Error(r.error)
  return new Uint8Array(await r.image.arrayBuffer())
}

async function factura({ fichero, url, ecLevel, ladoMm, xMm, yMm, rotulos, importe }) {
  const doc = await PDFDocument.create()
  const page = doc.addPage(A4)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const H = A4[1]
  const texto = (t, x, y, size = 10, f = font) => page.drawText(t, { x: x * MM, y: H - y * MM - size, size, font: f, color: rgb(0.1, 0.1, 0.1) })
  const png = await doc.embedPng(await qrPng(url, ecLevel))
  const lado = ladoMm * MM
  page.drawImage(png, { x: xMm * MM, y: H - yMm * MM - lado, width: lado, height: lado })
  if (rotulos) {
    const w = font.widthOfTextAtSize('QR tributario:', 10) / MM
    texto('QR tributario:', xMm + ladoMm / 2 - w / 2, yMm - 6)
    const v = font.widthOfTextAtSize('VERI*FACTU', 10) / MM
    texto('VERI*FACTU', xMm + ladoMm / 2 - v / 2, yMm + ladoMm + 2)
  }
  const y0 = 75
  texto('EMPRESA DE PRUEBAS SL · NIF 89890001K', 20, y0, 12, bold)
  texto('Factura 12345678/G33 · Fecha 01-01-2024', 20, y0 + 8)
  texto('Servicios de consultoría ........................ 111,10 €', 20, y0 + 20)
  texto('IVA ............................................... 12,35 €', 20, y0 + 27)
  texto(`TOTAL ............................................ ${importe} €`, 20, y0 + 36, 10, bold)
  await writeFile(new URL(`../examples/${fichero}`, import.meta.url), await doc.save())
}

const base = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR'
await factura({ fichero: 'factura-correcta.pdf', url: `${base}?nif=89890001K&numserie=12345678%2FG33&fecha=01-01-2024&importe=123.45`, ecLevel: 'M', ladoMm: 35, xMm: 87.5, yMm: 18, rotulos: true, importe: '123,45' })
await factura({ fichero: 'factura-incorrecta.pdf', url: `${base}?nif=89890001K&numserie=12345678%2FG33&fecha=01-01-2024&importe=200.00`, ecLevel: 'L', ladoMm: 22, xMm: 170, yMm: 255, rotulos: false, importe: '200,00' })
console.log('Facturas generadas en examples/')
