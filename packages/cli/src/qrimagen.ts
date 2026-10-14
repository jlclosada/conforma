import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'

let listo: Promise<unknown> | null = null

/** Carga el WASM de zxing desde el paquete local: nunca desde un CDN (todo en local). */
function preparar() {
  listo ??= (async () => {
    const require = createRequire(import.meta.url)
    const wasmBinary = await readFile(require.resolve('zxing-wasm/reader/zxing_reader.wasm'))
    return prepareZXingModule({ overrides: { wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength) as ArrayBuffer }, fireImmediately: true })
  })()
  return listo
}

export interface QrLeido { texto: string; nivelCorreccion: string }

/** Lee los códigos QR de una imagen PNG/JPG */
export async function leerQrDeImagen(ruta: string): Promise<QrLeido[]> {
  await preparar()
  const buf = await readFile(ruta)
  const res = await readBarcodes(new Uint8Array(buf), { formats: ['QRCode'], tryHarder: true })
  return res.filter((r) => r.isValid).map((r) => ({ texto: r.text, nivelCorreccion: String(r.ecLevel ?? '') }))
}
