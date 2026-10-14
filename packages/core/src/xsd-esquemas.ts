import { validateXML } from 'xmllint-wasm'
import type { Hallazgo } from './tipos.js'

/** Ficheros de esquema de la AEAT necesarios para validar (contenido incluido por quien llama) */
export interface FicheroEsquema { fileName: string; contents: string }
export const FICHEROS_ESQUEMA = ['SuministroLR.xsd', 'SuministroInformacion.xsd', 'EventosSIF.xsd', 'xmldsig-core-schema.xsd'] as const

/** Esquema principal según el elemento raíz del documento */
export function esquemaPara(raiz: string | undefined): string | null {
  if (raiz === 'RegFactuSistemaFacturacion') return 'SuministroLR.xsd'
  if (raiz === 'RegistroAlta' || raiz === 'RegistroAnulacion') return 'SuministroInformacion.xsd'
  if (raiz === 'RegistroEvento') return 'EventosSIF.xsd'
  return null
}

/**
 * Valida un XML contra los esquemas oficiales de la AEAT con libxml2 en WebAssembly.
 * Funciona en Node y en el navegador: los esquemas se pasan como contenido.
 */
export async function validarXsdConEsquemas(xml: string, raiz: string | undefined, esquemas: FicheroEsquema[], fichero = 'documento.xml'): Promise<Hallazgo[]> {
  const principal = esquemaPara(raiz)
  if (!principal) return [{ regla: 'XSD-000', severidad: 'media', noComprobado: true, mensaje: `No se valida contra XSD: raíz «${raiz ?? '?'}» no reconocida (se esperaba RegFactuSistemaFacturacion, RegistroAlta, RegistroAnulacion o RegistroEvento)` }]
  const schema = esquemas.find((s) => s.fileName === principal)
  if (!schema) throw new Error(`Falta el esquema ${principal}`)
  const res = await validateXML({ xml: [{ fileName: 'documento.xml', contents: xml }], schema: [schema], preload: esquemas.filter((s) => s !== schema) })
  return res.errors.map((e) => ({
    regla: 'XSD-001',
    severidad: 'alta' as const,
    mensaje: `No cumple el esquema ${principal}: ${e.message.trim()}`,
    obtenido: e.loc ? `${fichero}:${e.loc.lineNumber}` : fichero,
    referencia: `Esquemas XSD de la AEAT (${principal})`,
  }))
}
