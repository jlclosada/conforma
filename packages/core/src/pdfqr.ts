import type { MaquetacionQr, TextoPagina } from './maquetacion.js'

/**
 * Convierte una página de factura ya dibujada (píxeles + QR decodificados + textos de pdf.js)
 * en la descripción en milímetros que usa analizarMaquetacionQr. No depende de la plataforma:
 * la CLI dibuja con @napi-rs/canvas y la web con el canvas del navegador.
 */
export interface Punto { x: number; y: number }
export interface CodigoLeido { texto: string; nivelCorreccion: string; esquinas: Punto[] }
export interface TextoPdf { str: string; transform: number[]; width: number; height: number }

export interface PaginaDibujada {
  numero: number
  /** Tamaño de la página en puntos PDF */
  anchoPt: number
  altoPt: number
  /** Píxeles por punto del dibujo */
  escala: number
  pixeles: { data: Uint8ClampedArray | Uint8Array; width: number; height: number }
  codigos: CodigoLeido[]
  textos: TextoPdf[]
  /** Convierte un punto PDF (origen abajo a la izquierda) a coordenadas de página (origen arriba a la izquierda, en pt) */
  aPagina: (x: number, y: number) => [number, number]
}

export interface QrEnPagina { url: string; nivelCorreccion: string; maquetacion: MaquetacionQr }

const PT_A_MM = 25.4 / 72
export const esUrlAeat = (t: string) => /TIKE-CONT\/ValidarQR/i.test(t)

const caja = (c: CodigoLeido) => {
  const xs = c.esquinas.map((p) => p.x), ys = c.esquinas.map((p) => p.y)
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

export function maquetacionDesdePagina(p: PaginaDibujada): QrEnPagina | null {
  const trib = p.codigos.find((c) => esUrlAeat(c.texto))
  if (!trib) return null
  const b = caja(trib)
  const pxAmm = PT_A_MM / p.escala
  const esPrimerQr = p.numero === 1 && !p.codigos.some((c) => c !== trib && (caja(c).y1 < b.y0 || (Math.abs(caja(c).y0 - b.y0) < 5 && caja(c).x1 < b.x0)))

  // Margen libre: distancia al primer píxel oscuro fuera del símbolo, hasta 6 mm
  const { data, width, height } = p.pixeles
  const oscuro = (x: number, y: number) => {
    const xi = Math.round(x), yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= width || yi >= height) return false
    const i = (yi * width + xi) * 4
    return 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]! < 128
  }
  const limite = 6 / pxAmm
  let margen = 6
  for (let d = 1; d <= limite; d++) {
    let hay = false
    for (let x = b.x0 - d; x <= b.x1 + d && !hay; x++) hay = oscuro(x, b.y0 - d) || oscuro(x, b.y1 + d)
    for (let y = b.y0 - d; y <= b.y1 + d && !hay; y++) hay = oscuro(b.x0 - d, y) || oscuro(b.x1 + d, y)
    if (hay) { margen = d * pxAmm; break }
  }

  const textos: TextoPagina[] = []
  for (const it of p.textos) {
    if (!it.str.trim()) continue
    const [, , c = 0, d = 0, e = 0, f = 0] = it.transform
    const tamano = Math.hypot(c, d) || it.height
    const [vx, vy] = p.aPagina(e, f)
    textos.push({ texto: it.str, tamano, x: vx * PT_A_MM, y: (vy - tamano) * PT_A_MM, ancho: it.width * PT_A_MM, alto: tamano * PT_A_MM })
  }

  return {
    url: trib.texto,
    nivelCorreccion: trib.nivelCorreccion,
    maquetacion: {
      pagina: { numero: p.numero, ancho: p.anchoPt * PT_A_MM, alto: p.altoPt * PT_A_MM },
      qr: { x: b.x0 * pxAmm, y: b.y0 * pxAmm, ancho: (b.x1 - b.x0) * pxAmm, alto: (b.y1 - b.y0) * pxAmm },
      esPrimerQr,
      margenLibre: margen,
      textos,
      verifactu: /\/ValidarQR(\?|$)/.test(trib.texto),
    },
  }
}
