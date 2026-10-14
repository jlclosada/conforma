import type { Registro, RegistroEvento, RegistroFacturacion } from '../registros.js'
import type { Hallazgo } from '../tipos.js'
import { ref } from './huella.js'

const t = (x: string | undefined) => (x ?? '').trim()
const DOC = 'Orden HAC/1177/2024 · Encadenamiento de registros'

const instante = (s: string) => {
  const ms = Date.parse(t(s))
  return Number.isNaN(ms) ? null : ms
}

/** Reglas de encadenamiento de los registros de facturación (alta y anulación) en orden de aparición */
export function reglasCadena(regs: RegistroFacturacion[]): Hallazgo[] {
  const out: Hallazgo[] = []
  const altas = new Map<string, number>()
  const anuladas = new Set<string>()
  regs.forEach((r, i) => {
    const prev = regs[i - 1]
    const enc = r.encadenamiento
    if (i === 0) {
      if (!enc.primero && enc.anterior) {
        out.push({ regla: 'CAD-001', severidad: 'info', registro: ref(r), mensaje: 'El lote empieza a mitad de la cadena: el primer registro enlaza con otro que no está en los ficheros verificados. Ese enlace no se puede comprobar.' })
      }
    } else if (prev) {
      if (enc.primero) {
        out.push({ regla: 'CAD-002', severidad: 'alta', registro: ref(r), mensaje: 'Reinicio de la cadena: aparece «PrimerRegistro = S» después de otros registros', sugerencia: 'Solo el primer registro del sistema informático puede marcarse como primero. Si es una instalación nueva, verifícala por separado.' })
      } else if (!enc.anterior) {
        out.push({ regla: 'CAD-003', severidad: 'critica', registro: ref(r), mensaje: 'Falta el bloque Encadenamiento/RegistroAnterior' })
      } else {
        if (t(enc.anterior.huella) !== t(prev.huella)) {
          out.push({ regla: 'CAD-004', severidad: 'critica', registro: ref(r), mensaje: 'La cadena está rota: la huella del registro anterior no coincide con la del registro previo', esperado: t(prev.huella), obtenido: t(enc.anterior.huella) || '(vacío)', referencia: DOC })
        }
        const mism: string[] = []
        if (t(enc.anterior.idEmisor) !== t(prev.idEmisor)) mism.push(`emisor (${t(enc.anterior.idEmisor)} ≠ ${t(prev.idEmisor)})`)
        if (t(enc.anterior.numSerie) !== t(prev.numSerie)) mism.push(`número (${t(enc.anterior.numSerie)} ≠ ${t(prev.numSerie)})`)
        if (t(enc.anterior.fechaExpedicion) !== t(prev.fechaExpedicion)) mism.push(`fecha (${t(enc.anterior.fechaExpedicion)} ≠ ${t(prev.fechaExpedicion)})`)
        if (mism.length) out.push({ regla: 'CAD-005', severidad: 'alta', registro: ref(r), mensaje: `RegistroAnterior no identifica al registro previo: ${mism.join(', ')}`, referencia: DOC })
      }
      const a = instante(prev.fechaHoraGen), b = instante(r.fechaHoraGen)
      if (a !== null && b !== null && b < a) {
        out.push({ regla: 'CAD-006', severidad: 'media', registro: ref(r), mensaje: 'La fecha y hora de generación es anterior a la del registro previo', esperado: `≥ ${t(prev.fechaHoraGen)}`, obtenido: t(r.fechaHoraGen) })
      }
    }
    const clave = `${t(r.idEmisor)}|${t(r.numSerie)}|${t(r.fechaExpedicion)}`
    if (r.tipo === 'alta') {
      const subsana = t(r.subsanacion).toUpperCase() === 'S' || t(r.rechazoPrevio) !== ''
      if (altas.has(clave) && !subsana) out.push({ regla: 'CAD-007', severidad: 'alta', registro: ref(r), mensaje: `Factura dada de alta dos veces sin marcar subsanación (ya aparece en el registro ${altas.get(clave)! + 1})` })
      altas.set(clave, r.indice)
      anuladas.delete(clave)
    } else {
      if (anuladas.has(clave)) out.push({ regla: 'CAD-008', severidad: 'media', registro: ref(r), mensaje: 'Se anula una factura que ya estaba anulada en el lote' })
      else if (!altas.has(clave)) out.push({ regla: 'CAD-009', severidad: 'info', registro: ref(r), mensaje: 'Se anula una factura cuya alta no está en los ficheros verificados' })
      anuladas.add(clave)
    }
  })
  return out
}

/** Encadenamiento del registro de eventos (modalidad NO VERI*FACTU) */
export function reglasCadenaEventos(evs: RegistroEvento[]): Hallazgo[] {
  const out: Hallazgo[] = []
  evs.forEach((e, i) => {
    const prev = evs[i - 1]
    if (!prev) return
    if (e.primero) out.push({ regla: 'EVT-001', severidad: 'alta', registro: ref(e), mensaje: 'Reinicio de la cadena de eventos: «PrimerEvento = S» después de otros eventos' })
    else if (t(e.huellaAnterior) !== t(prev.huella)) out.push({ regla: 'EVT-002', severidad: 'critica', registro: ref(e), mensaje: 'La cadena de eventos está rota', esperado: t(prev.huella), obtenido: t(e.huellaAnterior) || '(vacío)' })
  })
  return out
}
