import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Hallazgo } from './tipos.js'
import { FICHEROS_ESQUEMA, validarXsdConEsquemas, type FicheroEsquema } from './xsd-esquemas.js'

export { esquemaPara } from './xsd-esquemas.js'

const DIR = fileURLToPath(new URL('../schemas/', import.meta.url))
let cache: FicheroEsquema[] | null = null

/** Valida un XML contra los esquemas oficiales de la AEAT incluidos en el paquete (Node). */
export async function validarXsd(xml: string, raiz: string | undefined, fichero = 'documento.xml'): Promise<Hallazgo[]> {
  cache ??= await Promise.all(FICHEROS_ESQUEMA.map(async (f) => ({ fileName: f, contents: await readFile(DIR + f, 'utf8') })))
  return validarXsdConEsquemas(xml, raiz, cache, fichero)
}
