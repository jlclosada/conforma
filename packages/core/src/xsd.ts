import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { validateXML } from 'xmllint-wasm'
import type { Hallazgo } from './tipos.js'

const DIR = fileURLToPath(new URL('../schemas/', import.meta.url))
const FICHEROS = ['SuministroLR.xsd', 'SuministroInformacion.xsd', 'EventosSIF.xsd', 'xmldsig-core-schema.xsd'] as const
let cache: { fileName: string; contents: string }[] | null = null

async function esquemas() {
  cache ??= await Promise.all(FICHEROS.map(async (f) => ({ fileName: f, contents: await readFile(DIR + f, 'utf8') })))
  return cache
}

/** Esquema principal según el elemento raíz del documento */
export function esquemaPara(raiz: string | undefined): string | null {
  if (raiz === 'RegFactuSistemaFacturacion') return 'SuministroLR.xsd'
  if (raiz === 'RegistroAlta' || raiz === 'RegistroAnulacion') return 'SuministroInformacion.xsd'
  if (raiz === 'RegistroEvento') return 'EventosSIF.xsd'
  return null
}

/**
 * Valida un XML contra los esquemas oficiales de la AEAT (incluidos en el paquete).
 * Solo para documentos cuya raíz es un envío o un registro; los sobres SOAP se validan
 * extrayendo antes el cuerpo.
 */
export async function validarXsd(xml: string, raiz: string | undefined, fichero = 'documento.xml'): Promise<Hallazgo[]> {
  const principal = esquemaPara(raiz)
  if (!principal) return [{ regla: 'XSD-000', severidad: 'info', mensaje: `No se valida contra XSD: raíz «${raiz ?? '?'}» no reconocida (se esperaba RegFactuSistemaFacturacion, RegistroAlta, RegistroAnulacion o RegistroEvento)` }]
  const todos = await esquemas()
  const schema = todos.find((s) => s.fileName === principal)!
  const res = await validateXML({ xml: [{ fileName: 'documento.xml', contents: xml }], schema: [schema], preload: todos.filter((s) => s !== schema) })
  return res.errors.map((e) => ({
    regla: 'XSD-001',
    severidad: 'alta' as const,
    mensaje: `No cumple el esquema ${principal}: ${e.message.trim()}`,
    obtenido: e.loc ? `${fichero}:${e.loc.lineNumber}` : fichero,
    referencia: `Esquemas XSD de la AEAT (${principal})`,
  }))
}
