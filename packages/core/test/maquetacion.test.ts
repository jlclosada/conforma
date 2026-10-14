import { describe, expect, it } from 'vitest'
import { analizarMaquetacionQr, type MaquetacionQr } from '../src/index.js'

const base: MaquetacionQr = {
  pagina: { numero: 1, ancho: 210, alto: 297 },
  qr: { x: 87.5, y: 18, ancho: 35, alto: 35 },
  esPrimerQr: true,
  margenLibre: 6,
  verifactu: true,
  textos: [
    { texto: 'QR tributario:', x: 95, y: 11, ancho: 22, alto: 3.5, tamano: 10 },
    { texto: 'VERI*FACTU', x: 96, y: 55, ancho: 20, alto: 3.5, tamano: 10 },
    { texto: 'Factura 12345678/G33', x: 20, y: 80, ancho: 60, alto: 3.5, tamano: 10 },
  ],
}
const reglas = (m: Partial<MaquetacionQr>) => analizarMaquetacionQr({ ...base, ...m }).map((h) => h.regla)

describe('maquetación del QR en la factura', () => {
  it('una maquetación correcta no tiene hallazgos', () => expect(analizarMaquetacionQr(base)).toEqual([]))
  it('tamaño fuera de 30–40 mm', () => {
    expect(reglas({ qr: { ...base.qr, ancho: 25, alto: 25 } })).toContain('QR-010')
    expect(reglas({ qr: { ...base.qr, ancho: 45, alto: 45 } })).toContain('QR-010')
  })
  it('margen en blanco', () => {
    expect(analizarMaquetacionQr({ ...base, margenLibre: 1 }).find((h) => h.regla === 'QR-011')?.severidad).toBe('alta')
    expect(analizarMaquetacionQr({ ...base, margenLibre: 3 }).find((h) => h.regla === 'QR-011')?.severidad).toBe('info')
  })
  it('página, orden y posición', () => {
    expect(reglas({ pagina: { ...base.pagina, numero: 2 } })).toContain('QR-012')
    expect(reglas({ esPrimerQr: false })).toContain('QR-012')
    expect(reglas({ qr: { ...base.qr, y: 200 }, textos: [] })).toContain('QR-013')
  })
  it('textos obligatorios y su tamaño', () => {
    expect(reglas({ textos: base.textos.slice(1) })).toContain('QR-014')
    expect(reglas({ textos: [base.textos[0]!, base.textos[2]!] })).toContain('QR-015')
    expect(reglas({ verifactu: false, textos: [base.textos[0]!, base.textos[2]!] })).not.toContain('QR-015')
    const pequeno = [{ ...base.textos[0]!, tamano: 6 }, base.textos[1]!, base.textos[2]!]
    expect(reglas({ textos: pequeno })).toContain('QR-016')
    const fraseLarga = [base.textos[0]!, { texto: 'Factura verificable en la sede', x: 90, y: 55, ancho: 30, alto: 3.5, tamano: 10 }, { texto: 'electrónica de la AEAT', x: 92, y: 59, ancho: 26, alto: 3.5, tamano: 10 }, base.textos[2]!]
    expect(reglas({ textos: fraseLarga })).toEqual([])
  })
})
