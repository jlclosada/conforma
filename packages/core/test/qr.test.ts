import { describe, expect, it } from 'vitest'
import { analizarUrlQr, construirUrlQr } from '../src/index.js'
import type { RegistroAlta } from '../src/index.js'

// Ejemplos del documento «Especificaciones del código QR» (AEAT v0.5.0)
const OK_PRE = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678-G33&fecha=01-09-2024&importe=241.4'
const OK_PROD_NOVF = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=89890001K&numserie=12345678-G33&fecha=01-09-2024&importe=241.4'
const regla = (url: string, opts = {}) => analizarUrlQr(url, opts).hallazgos.map((h) => h.regla)

describe('URL del QR', () => {
  it('acepta los ejemplos válidos de la AEAT', () => {
    expect(analizarUrlQr(OK_PRE).hallazgos).toEqual([])
    const { qr, hallazgos } = analizarUrlQr(OK_PROD_NOVF)
    expect(hallazgos).toEqual([])
    expect(qr).toMatchObject({ entorno: 'produccion', verificable: false, importe: '241.4' })
  })
  it('detecta un «&» sin codificar en el número de serie (ejemplo erróneo de la AEAT)', () => {
    const mal = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678&G33&fecha=01-01-2024&importe=241.4'
    expect(regla(mal)).toContain('QR-003')
    const bien = construirUrlQr({ nif: '89890001K', numserie: '12345678&G33', fecha: '01-01-2024', importe: '241.4' }, 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR')
    expect(bien).toBe('https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678%26G33&fecha=01-01-2024&importe=241.4')
    expect(analizarUrlQr(bien).hallazgos).toEqual([])
  })
  it('detecta importe con coma (error 2005) y NIF inválido (error 2001)', () => {
    expect(regla('https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678-G33&fecha=01-01-2024&importe=7,2')).toContain('QR-005')
    expect(analizarUrlQr('https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=891K&numserie=12345678-G33&fecha=01-01-2024&importe=241.4').hallazgos[0]?.mensaje).toMatch(/2001/)
  })
  it('detecta parámetros que faltan, «formato» prohibido y dominio ajeno', () => {
    expect(regla('https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=A1')).toContain('QR-004')
    expect(regla(`${OK_PRE}&formato=json`)).toContain('QR-002')
    expect(regla('https://ejemplo.com/ValidarQR?nif=89890001K&numserie=A1&fecha=01-01-2024&importe=1')).toContain('QR-001')
  })
  it('comprueba que el QR cuadra con el registro de facturación', () => {
    const registro = { tipo: 'alta', indice: 0, idEmisor: '89890001K', numSerie: '12345678-G33', fechaExpedicion: '01-09-2024', importeTotal: '241.40' } as RegistroAlta
    expect(regla(OK_PRE, { registro })).toEqual([])
    expect(regla(OK_PRE, { registro: { ...registro, importeTotal: '250.00' } })).toContain('QR-006')
  })
})
