import { DOC_QR } from './qr.js'
import type { Hallazgo } from './tipos.js'

/**
 * Comprobaciones de tamaño, posición y textos del QR en la factura, según el art. 21 de la
 * Orden HAC/1177/2024 y el apartado 3 del documento técnico del QR (AEAT v0.5.0).
 * Todas las medidas en milímetros, con origen en la esquina superior izquierda de la página.
 */
export interface Caja { x: number; y: number; ancho: number; alto: number }
export interface TextoPagina extends Caja { texto: string; tamano: number }

export interface MaquetacionQr {
  pagina: { numero: number; ancho: number; alto: number }
  /** Caja del símbolo QR (sin la zona en blanco) */
  qr: Caja
  /** ¿Es el primer QR de la factura (el más arriba / a la izquierda de la primera página)? */
  esPrimerQr: boolean
  /** Margen libre medido alrededor del QR (mm); undefined si no se pudo medir */
  margenLibre?: number
  textos: TextoPagina[]
  /** El QR apunta a un sistema VERI*FACTU (URL ValidarQR) */
  verifactu: boolean
}

const REF = `${DOC_QR}, apartado 3 · Orden HAC/1177/2024, art. 21`
const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0 }
const redondeo = (n: number) => Math.round(n * 10) / 10

export function analizarMaquetacionQr(m: MaquetacionQr): Hallazgo[] {
  const out: Hallazgo[] = []
  const add = (regla: string, severidad: Hallazgo['severidad'], mensaje: string, extra: Partial<Hallazgo> = {}) => out.push({ regla, severidad, mensaje, referencia: REF, ...extra })
  const { qr, pagina } = m

  // Tamaño: entre 30x30 y 40x40 mm (tolerancia de 0,5 mm por el redondeo de la medida)
  const lado = Math.max(qr.ancho, qr.alto)
  if (lado < 29.5 || lado > 40.5) add('QR-010', 'alta', `El QR mide ${redondeo(qr.ancho)} × ${redondeo(qr.alto)} mm; debe estar entre 30×30 y 40×40 mm`, { esperado: '30–40 mm', obtenido: `${redondeo(lado)} mm` })

  if (m.margenLibre !== undefined) {
    if (m.margenLibre < 2) add('QR-011', 'alta', `Hay contenido a ${redondeo(m.margenLibre)} mm del QR; se exigen al menos 2 mm en blanco alrededor`, { esperado: '≥ 2 mm (recomendado 6 mm)', obtenido: `${redondeo(m.margenLibre)} mm` })
    else if (m.margenLibre < 6) add('QR-011', 'info', `El margen en blanco alrededor del QR es de ${redondeo(m.margenLibre)} mm; la AEAT recomienda 6 mm`)
  }

  if (pagina.numero !== 1) add('QR-012', 'alta', `El QR está en la página ${pagina.numero}; debe aparecer una única vez, en la primera página`)
  if (!m.esPrimerQr) add('QR-012', 'media', 'Hay otro código QR por delante del tributario; este debe ser el primero de la factura')

  const vertical = pagina.alto >= pagina.ancho
  if (vertical && qr.y > pagina.alto * 0.3) add('QR-013', 'media', 'En facturas verticales el QR debe ir arriba, cerca del margen superior y al principio del contenido', { obtenido: `a ${redondeo(qr.y)} mm del borde superior` })
  if (!vertical && qr.x > pagina.ancho * 0.35) add('QR-013', 'media', 'En facturas apaisadas el QR debe ir a la izquierda, preferiblemente arriba', { obtenido: `a ${redondeo(qr.x)} mm del borde izquierdo` })

  // Textos cercanos: encima «QR tributario:», debajo «VERI*FACTU» o la frase completa
  const solapa = (t: TextoPagina) => t.x < qr.x + qr.ancho + 15 && t.x + t.ancho > qr.x - 15
  const encima = m.textos.filter((t) => solapa(t) && t.y + t.alto <= qr.y + 1 && qr.y - (t.y + t.alto) < 15)
  const debajo = m.textos.filter((t) => solapa(t) && t.y >= qr.y + qr.alto - 1 && t.y - (qr.y + qr.alto) < 20)
  const tamanoNormal = mediana(m.textos.map((t) => t.tamano))

  const rotulo = encima.find((t) => normal(t.texto).includes('qr tributario'))
  if (!rotulo) add('QR-014', 'alta', 'Falta el texto «QR tributario:» justo encima del código QR')
  else if (rotulo.tamano + 0.1 < tamanoNormal) add('QR-016', 'media', 'El texto «QR tributario:» es más pequeño que el resto de datos de la factura', { obtenido: `${redondeo(rotulo.tamano)} pt`, esperado: `≥ ${redondeo(tamanoNormal)} pt` })

  if (m.verifactu) {
    const unido = normal(debajo.sort((a, b) => a.y - b.y || a.x - b.x).map((t) => t.texto).join(' '))
    const ok = unido.includes('veri*factu') || unido.includes('factura verificable en la sede electronica de la aeat')
    if (!ok) add('QR-015', 'alta', 'Falta debajo del QR la frase «Factura verificable en la sede electrónica de la AEAT» o «VERI*FACTU»')
    else {
      const leyenda = debajo.find((t) => /veri\*factu|verificable/.test(normal(t.texto)))
      if (leyenda && leyenda.tamano + 0.1 < tamanoNormal) add('QR-016', 'media', 'La leyenda VERI*FACTU es más pequeña que el resto de datos de la factura', { obtenido: `${redondeo(leyenda.tamano)} pt`, esperado: `≥ ${redondeo(tamanoNormal)} pt` })
    }
  }
  return out
}
