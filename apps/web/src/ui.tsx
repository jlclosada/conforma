import type { ReactNode } from 'react'
import { Binary, CircleCheck, CircleDashed, CircleHelp, CircleX, FileCode2, Link2, QrCode, Ruler, ScanLine, type LucideIcon } from 'lucide-react'
import type { Area, EstadoArea, Severidad, Veredicto } from '@conforma/core'

export const AREA: Record<Area, { nombre: string; icono: LucideIcon; detalle: string }> = {
  formato: { nombre: 'Formatos', icono: FileCode2, detalle: 'NIF con dígito de control, número de serie, fechas, importes y tipos de factura' },
  huella: { nombre: 'Huella SHA-256', icono: Binary, detalle: 'Recalcula la huella de cada alta, anulación y evento con el algoritmo oficial' },
  cadena: { nombre: 'Encadenamiento', icono: Link2, detalle: 'Enlace con el registro anterior, primer registro, orden temporal y duplicados' },
  xsd: { nombre: 'Esquemas XSD', icono: ScanLine, detalle: 'SuministroLR, SuministroInformacion y EventosSIF oficiales, con libxml2' },
  qr: { nombre: 'Contenido del QR', icono: QrCode, detalle: 'Dominio, cuatro parámetros, codificación y coherencia con el registro' },
  maquetacion: { nombre: 'QR en la factura', icono: Ruler, detalle: '30–40 mm, nivel M, margen en blanco, posición y rótulos obligatorios' },
}

export const ESTADO: Record<EstadoArea, { nombre: string; icono: LucideIcon; texto: string; fondo: string }> = {
  ok: { nombre: 'Superado', icono: CircleCheck, texto: 'text-ok', fondo: 'bg-ok-soft' },
  falla: { nombre: 'Falla', icono: CircleX, texto: 'text-fail', fondo: 'bg-fail-soft' },
  no_comprobado: { nombre: 'No comprobado', icono: CircleHelp, texto: 'text-warn', fondo: 'bg-warn-soft' },
  sin_datos: { nombre: 'Sin datos', icono: CircleDashed, texto: 'text-muted', fondo: 'bg-sunken' },
}

export const VEREDICTO: Record<Veredicto, { titulo: string; sello: string; texto: string; fondo: string; borde: string; resumen: string }> = {
  aprobado: { titulo: 'Aprobado', sello: 'CONFORME', texto: 'text-ok', fondo: 'bg-ok-soft', borde: 'border-ok', resumen: 'Todo lo aportado se ha comprobado y no hay hallazgos críticos ni altos.' },
  falla: { titulo: 'Falla', sello: 'NO CONFORME', texto: 'text-fail', fondo: 'bg-fail-soft', borde: 'border-fail', resumen: 'Hay hallazgos críticos o altos que incumplen las especificaciones de la AEAT.' },
  no_comprobado: { titulo: 'No comprobado', sello: 'INCOMPLETO', texto: 'text-warn', fondo: 'bg-warn-soft', borde: 'border-warn', resumen: 'No hay fallos, pero alguna comprobación no se ha podido hacer. No se puede dar por bueno.' },
}

export const SEV: Record<Severidad, { nombre: string; texto: string; fondo: string; barra: string }> = {
  critica: { nombre: 'Crítico', texto: 'text-fail', fondo: 'bg-fail-soft', barra: 'bg-fail' },
  alta: { nombre: 'Alto', texto: 'text-fail', fondo: 'bg-fail-soft', barra: 'bg-fail/60' },
  media: { nombre: 'Medio', texto: 'text-warn', fondo: 'bg-warn-soft', barra: 'bg-warn' },
  info: { nombre: 'Info', texto: 'text-info', fondo: 'bg-info-soft', barra: 'bg-info/50' },
}

export function Logo({ className = 'size-8' }: { className?: string }) {
  // Sello: un círculo dentado con una marca de verificación
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path fill="var(--accent)" d="M16 1.5l2.6 2.3 3.4-.8 1.4 3.2 3.3 1.1-.2 3.5 2.5 2.4-1.6 3.1 1.6 3.1-2.5 2.4.2 3.5-3.3 1.1-1.4 3.2-3.4-.8L16 30.5l-2.6-2.3-3.4.8-1.4-3.2-3.3-1.1.2-3.5L3 18.8l1.6-3.1L3 12.6l2.5-2.4-.2-3.5 3.3-1.1L10 2.4l3.4.8z" />
      <path d="M10.5 16.5l3.8 3.8 7.4-8" fill="none" stroke="var(--accent-ink)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Etiqueta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[11px] font-medium tracking-[0.14em] text-muted uppercase ${className}`}>{children}</span>
}

export function TituloSeccion({ etiqueta, titulo, children }: { etiqueta: string; titulo: ReactNode; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <Etiqueta>{etiqueta}</Etiqueta>
      <h2 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">{titulo}</h2>
      {children && <p className="mt-4 text-[15px] leading-relaxed text-ink-2 text-pretty">{children}</p>}
    </div>
  )
}

/** Huella abreviada para mostrar: 8 primeros y 4 últimos caracteres */
export const corta = (h?: string) => (!h ? '—' : h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-4)}` : h)
