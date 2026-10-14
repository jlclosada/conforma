import { DOC_HUELLA, verificarHuellaAlta, verificarHuellaAnulacion, verificarHuellaEvento } from '../huella.js'
import { etiqueta, type Registro } from '../registros.js'
import type { Hallazgo, RefRegistro } from '../tipos.js'

export const ref = (r: Registro): RefRegistro => ({ indice: r.indice, tipo: r.tipo, etiqueta: etiqueta(r), fichero: r.fichero })

/** HUE-001 formato · HUE-002 recálculo · HUE-003 tipo de huella */
export function reglasHuella(r: Registro): Hallazgo[] {
  const out: Hallazgo[] = []
  const informada = (r.huella ?? '').trim()
  if (!informada) {
    out.push({ regla: 'HUE-001', severidad: 'critica', registro: ref(r), mensaje: 'El registro no tiene huella', referencia: DOC_HUELLA, sugerencia: 'La huella es obligatoria en todos los registros, también en el primero.' })
    return out
  }
  if (!/^[0-9A-F]{64}$/.test(informada)) {
    const minusculas = /^[0-9a-fA-F]{64}$/.test(informada)
    out.push({
      regla: 'HUE-001', severidad: 'alta', registro: ref(r), obtenido: informada,
      mensaje: minusculas ? 'La huella está en minúsculas; la AEAT exige hexadecimal en mayúsculas' : 'La huella no son 64 caracteres hexadecimales',
      referencia: `${DOC_HUELLA}, apartado 5`,
    })
  }
  if ((r.tipoHuella ?? '').trim() !== '01') {
    out.push({ regla: 'HUE-003', severidad: 'alta', registro: ref(r), esperado: '01', obtenido: r.tipoHuella ?? '(vacío)', mensaje: 'TipoHuella debe ser 01 (SHA-256), el único algoritmo permitido', referencia: `${DOC_HUELLA}, apartado 2 (Lista L12)` })
  }
  const res = r.tipo === 'alta' ? verificarHuellaAlta(r) : r.tipo === 'anulacion' ? verificarHuellaAnulacion(r) : verificarHuellaEvento(r)
  if (!res.coincide) {
    out.push({
      regla: 'HUE-002', severidad: 'critica', registro: ref(r),
      mensaje: 'La huella informada no coincide con la calculada. En VERI*FACTU la AEAT marcaría el registro como «Aceptado con errores»',
      esperado: res.calculada, obtenido: informada, referencia: `${DOC_HUELLA}, apartados 3 y 7`,
      sugerencia: `Cadena usada para el cálculo:\n${res.cadena}`,
    })
  } else if (res.varianteImportes) {
    out.push({ regla: 'HUE-004', severidad: 'info', registro: ref(r), mensaje: `La huella coincide usando otra representación equivalente de los importes (${res.varianteImportes.cuota} / ${res.varianteImportes.importe}); la AEAT las trata igual`, referencia: `${DOC_HUELLA}, apartado 3` })
  }
  return out
}
