/** Validación del NIF español: DNI, NIE y NIF de personas jurídicas (antiguo CIF). */
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

export type TipoNif = 'dni' | 'nie' | 'juridica' | 'especial'

export function validarNif(nif: string): { valido: boolean; tipo?: TipoNif; motivo?: string } {
  const n = nif.trim().toUpperCase()
  if (n.length !== 9) return { valido: false, motivo: 'Debe tener 9 caracteres' }
  if (/^\d{8}[A-Z]$/.test(n)) {
    const ok = LETRAS_DNI[Number(n.slice(0, 8)) % 23] === n[8]
    return ok ? { valido: true, tipo: 'dni' } : { valido: false, tipo: 'dni', motivo: 'La letra de control no corresponde' }
  }
  if (/^[XYZ]\d{7}[A-Z]$/.test(n)) {
    const num = String('XYZ'.indexOf(n[0]!)) + n.slice(1, 8)
    const ok = LETRAS_DNI[Number(num) % 23] === n[8]
    return ok ? { valido: true, tipo: 'nie' } : { valido: false, tipo: 'nie', motivo: 'La letra de control no corresponde' }
  }
  if (/^[KLM]\d{7}[A-Z]$/.test(n)) return { valido: true, tipo: 'especial' }
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(n)) {
    const d = n.slice(1, 8).split('').map(Number)
    let suma = 0
    d.forEach((x, i) => {
      if (i % 2 === 1) suma += x
      else { const y = x * 2; suma += Math.floor(y / 10) + (y % 10) }
    })
    const control = (10 - (suma % 10)) % 10
    const letra = 'JABCDEFGHI'[control]!
    const c = n[8]!
    const soloLetra = 'NPQRSW'.includes(n[0]!)
    const soloNumero = 'ABEH'.includes(n[0]!)
    const ok = soloLetra ? c === letra : soloNumero ? c === String(control) : c === letra || c === String(control)
    return ok ? { valido: true, tipo: 'juridica' } : { valido: false, tipo: 'juridica', motivo: 'El carácter de control no corresponde' }
  }
  return { valido: false, motivo: 'Formato no reconocido' }
}
