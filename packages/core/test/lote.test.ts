import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { leerXml, verificar, validarNif } from '../src/index.js'
import { validarXsd } from '../src/xsd.js'

const ej = (f: string) => readFileSync(new URL(`../../../examples/${f}`, import.meta.url), 'utf8')

describe('lectura y verificación de lotes', () => {
  it('lee los tres registros del lote en orden', () => {
    const { registros, raiz } = leerXml(ej('lote-correcto.xml'))
    expect(raiz).toBe('RegFactuSistemaFacturacion')
    expect(registros.map((r) => r.tipo)).toEqual(['alta', 'alta', 'anulacion'])
  })
  it('el lote oficial no tiene hallazgos críticos ni altos', () => {
    const informe = verificar(leerXml(ej('lote-correcto.xml')).registros)
    expect(informe.hallazgos.filter((h) => h.severidad !== 'info')).toEqual([])
    // sin XSD no se puede aprobar: el veredicto honesto es «no comprobado»
    expect(informe.veredicto).toBe('no_comprobado')
    expect(informe.cobertura).toMatchObject({ huella: 'ok', cadena: 'ok', formato: 'ok', xsd: 'no_comprobado', qr: 'sin_datos' })
    expect(verificar(leerXml(ej('lote-correcto.xml')).registros, [], { comprobadas: ['xsd'] }).veredicto).toBe('aprobado')
  })
  it('un XSD que no se pudo ejecutar nunca da «aprobado»', () => {
    const { registros } = leerXml(ej('lote-correcto.xml'))
    const informe = verificar(registros, [{ regla: 'XSD-000', severidad: 'media', noComprobado: true, mensaje: 'no carga' }], { comprobadas: ['xsd'] })
    expect(informe.veredicto).toBe('no_comprobado')
    expect(informe.cobertura.xsd).toBe('no_comprobado')
  })
  it('sin nada que comprobar el veredicto es «no comprobado»', () => {
    expect(verificar([]).veredicto).toBe('no_comprobado')
  })
  it('detecta la manipulación del importe y la cadena rota', () => {
    const informe = verificar(leerXml(ej('lote-manipulado.xml')).registros)
    const reglas = informe.hallazgos.map((h) => `${h.regla}@${h.registro?.indice}`)
    expect(reglas).toContain('HUE-002@1') // huella de la factura manipulada
    expect(reglas).toContain('CAD-004@2') // la anulación enlaza con otra huella
    expect(reglas).toContain('HUE-002@2')
    expect(informe.veredicto).toBe('falla')
    expect(informe.cobertura.huella).toBe('falla')
  })
  it('detecta un reinicio de cadena y fechas que retroceden', () => {
    const { registros } = leerXml(ej('lote-correcto.xml'))
    const [a, b] = registros
    const informe = verificar([a!, { ...b!, indice: 1, fechaHoraGen: '2024-01-01T19:00:00+01:00' } as typeof b & object])
    expect(informe.hallazgos.some((h) => h.regla === 'CAD-006')).toBe(true)
  })
})

describe('esquemas XSD oficiales', () => {
  it('el lote correcto cumple SuministroLR.xsd', async () => {
    const xml = ej('lote-correcto.xml')
    expect(await validarXsd(xml, leerXml(xml).raiz)).toEqual([])
  })
  it('un elemento desconocido no cumple el esquema', async () => {
    const xml = ej('lote-correcto.xml').replace('<sf:TipoFactura>F1</sf:TipoFactura>', '<sf:TipoFactura>F9</sf:TipoFactura>')
    const errores = await validarXsd(xml, 'RegFactuSistemaFacturacion')
    expect(errores.length).toBeGreaterThan(0)
    expect(errores[0]!.regla).toBe('XSD-001')
  })
})

describe('NIF', () => {
  it.each([['89890001K', true], ['12345678Z', true], ['12345678A', false], ['X1234567L', true], ['B12345674', true], ['B1234567A', false], ['891K', false]])('%s → %s', (nif, ok) => {
    expect(validarNif(nif).valido).toBe(ok)
  })
})
