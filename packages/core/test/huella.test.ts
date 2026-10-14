import { describe, expect, it } from 'vitest'
import { cadenaAlta, cadenaAnulacion, calcularHuella, variantesImporte, verificarHuellaAlta } from '../src/index.js'
import type { RegistroAlta } from '../src/index.js'

// Vectores oficiales: «Especificaciones técnicas para generación de la huella» (AEAT v0.1.2, apartado 6)
const CASO1 = 'IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00'
const H1 = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60'
const H2 = 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97'
const H3 = '177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68'

const alta1: RegistroAlta = {
  tipo: 'alta', indice: 0, idEmisor: '89890001K', numSerie: '12345678/G33', fechaExpedicion: '01-01-2024', tipoFactura: 'F1',
  cuotaTotal: '12.35', importeTotal: '123.45', fechaHoraGen: '2024-01-01T19:20:30+01:00', tipoHuella: '01', huella: H1,
  encadenamiento: { primero: true },
}

describe('huella: vectores oficiales de la AEAT', () => {
  it('caso 1: primer registro de alta', () => {
    expect(cadenaAlta(alta1)).toBe(CASO1)
    expect(calcularHuella(CASO1)).toBe(H1)
  })
  it('caso 2: segundo registro de alta encadenado', () => {
    const c = cadenaAlta({ ...alta1, numSerie: '12345679/G34', fechaHoraGen: '2024-01-01T19:20:35+01:00', encadenamiento: { primero: false, anterior: { huella: H1 } } })
    expect(calcularHuella(c)).toBe(H2)
  })
  it('caso 3: registro de anulación encadenado', () => {
    const c = cadenaAnulacion({ idEmisor: '89890001K', numSerie: '12345679/G34', fechaExpedicion: '01-01-2024', fechaHoraGen: '2024-01-01T19:20:40+01:00', encadenamiento: { primero: false, anterior: { huella: H2 } } })
    expect(calcularHuella(c)).toBe(H3)
  })
})

describe('huella: tratamiento de valores', () => {
  it('quita los espacios al inicio y al final de cada valor', () => {
    expect(verificarHuellaAlta({ ...alta1, numSerie: '  12345678/G33 ', idEmisor: ' 89890001K' }).coincide).toBe(true)
  })
  it('acepta importes con uno o dos decimales como equivalentes', () => {
    expect(variantesImporte('123.1')).toEqual(['123.1', '123.10'])
    expect(variantesImporte('123.00')).toEqual(['123.00', '123.0', '123'])
    // El SIF calculó la huella con «100.10» pero el XML lleva «100.1»: la AEAT lo da por bueno
    const base = { ...alta1, importeTotal: '100.10', cuotaTotal: '10.00' }
    const huella = calcularHuella(cadenaAlta(base))
    const r = verificarHuellaAlta({ ...base, importeTotal: '100.1', cuotaTotal: '10', huella })
    expect(r.coincide).toBe(true)
    expect(r.varianteImportes).toEqual({ cuota: '10.00', importe: '100.10' })
  })
  it('detecta un importe manipulado', () => {
    const r = verificarHuellaAlta({ ...alta1, importeTotal: '1123.45' })
    expect(r.coincide).toBe(false)
    expect(r.calculada).not.toBe(H1)
  })
})
