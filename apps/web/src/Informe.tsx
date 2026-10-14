import { useMemo, useState } from 'react'
import { Check, ChevronDown, Copy, Download, FileText, Fingerprint, Printer, X } from 'lucide-react'
import { AREAS, FALLA, areaDeRegla, type Area, type Hallazgo, type Severidad } from '@conforma/core'
import type { Eslabon, QrAnalizado, Resultado } from './analisis'
import { AREA, ESTADO, Etiqueta, SEV, VEREDICTO, corta } from './ui'

const SEVERIDADES: Severidad[] = ['critica', 'alta', 'media', 'info']

export function Informe({ res }: { res: Resultado }) {
  const { informe } = res
  const [registro, setRegistro] = useState<number | null>(null)
  const [area, setArea] = useState<Area | null>(null)
  const [sevs, setSevs] = useState<Set<Severidad>>(new Set(['critica', 'alta', 'media']))

  const peorPorRegistro = useMemo(() => {
    const m = new Map<number, Severidad>()
    for (const h of informe.hallazgos) {
      if (!h.registro) continue
      const actual = m.get(h.registro.indice)
      if (!actual || SEVERIDADES.indexOf(h.severidad) < SEVERIDADES.indexOf(actual)) m.set(h.registro.indice, h.severidad)
    }
    return m
  }, [informe])

  const visibles = informe.hallazgos.filter((h) =>
    sevs.has(h.severidad) && (registro === null || h.registro?.indice === registro) && (area === null || areaDeRegla(h.regla) === area))

  const descargar = () => {
    const a = document.createElement('a')
    const datos = { herramienta: 'verifactu-lint (web)', fecha: new Date().toISOString(), ficheros: res.ficheros, ...informe }
    a.href = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }))
    a.download = `verifactu-lint-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section id="informe" className="informe mx-auto mt-14 max-w-6xl animate-entrar px-4 sm:px-6">
      <div className="solo-imprimir mb-6 border-b border-line pb-4">
        <div className="font-display text-3xl">Informe de verificación Verifactu</div>
        <div className="text-xs text-muted">Generado con verifactu-lint · {new Date().toLocaleString('es-ES')} · Verificación técnica automática; no es una homologación de la AEAT.</div>
      </div>

      <Veredicto res={res} />

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {AREAS.map((a) => {
          const e = ESTADO[informe.cobertura[a]]
          const n = informe.hallazgos.filter((h) => areaDeRegla(h.regla) === a && h.severidad !== 'info').length
          const activo = area === a
          return (
            <button key={a} onClick={() => setArea(activo ? null : a)} className={`rotura group flex flex-col gap-3 p-4 text-left transition ${activo ? 'bg-sunken' : 'bg-surface hover:bg-sunken/60'}`} aria-pressed={activo}>
              <div className="flex items-center justify-between">
                {(() => { const I = AREA[a].icono; return <I className="size-4 text-muted" strokeWidth={1.75} /> })()}
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${e.texto} ${e.fondo}`}><e.icono className="size-3" />{e.nombre}</span>
              </div>
              <div>
                <div className="text-sm font-medium">{AREA[a].nombre}</div>
                <div className="mt-0.5 text-xs leading-snug text-muted">{n ? `${n} hallazgo${n > 1 ? 's' : ''}` : AREA[a].detalle}</div>
              </div>
            </button>
          )
        })}
      </div>

      {res.cadena.length > 0 && <Cadena cadena={res.cadena} peor={peorPorRegistro} hallazgos={informe.hallazgos} seleccionado={registro} seleccionar={setRegistro} />}

      {res.qrs.some((q) => q.maquetacion) && (
        <div className="mt-10">
          <Etiqueta>Código QR en la factura</Etiqueta>
          <div className={`mt-3 grid gap-4 ${res.qrs.filter((q) => q.maquetacion).length > 1 ? 'lg:grid-cols-2' : ''}`}>
            {res.qrs.filter((q) => q.maquetacion).map((q) => <InspectorQr key={q.fuente} q={q} hallazgos={informe.hallazgos.filter((h) => h.mensaje.includes(`[${q.fuente}]`))} />)}
          </div>
        </div>
      )}

      <div className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Etiqueta>Hallazgos</Etiqueta>
            <div className="mt-1 text-sm text-muted">
              {visibles.length} de {informe.hallazgos.length}
              {registro !== null && <Filtro onQuitar={() => setRegistro(null)}>registro #{registro + 1}</Filtro>}
              {area && <Filtro onQuitar={() => setArea(null)}>{AREA[area].nombre}</Filtro>}
            </div>
          </div>
          <div className="no-imprimir flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-line bg-surface p-0.5">
              {SEVERIDADES.map((s) => {
                const on = sevs.has(s)
                return (
                  <button key={s} aria-pressed={on} onClick={() => { const n = new Set(sevs); if (on) n.delete(s); else n.add(s); setSevs(n) }}
                    className={`num inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${on ? `${SEV[s].fondo} ${SEV[s].texto}` : 'text-muted hover:text-ink'}`}>
                    {SEV[s].nombre}<span className="opacity-70">{informe.porSeveridad[s]}</span>
                  </button>
                )
              })}
            </div>
            <button onClick={descargar} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium hover:bg-sunken"><Download className="size-3.5" />JSON</button>
            <button onClick={() => window.print()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium hover:bg-sunken"><Printer className="size-3.5" />Informe PDF</button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
          {visibles.length === 0
            ? <p className="p-10 text-center text-sm text-muted">{informe.hallazgos.length ? 'Ningún hallazgo con estos filtros.' : 'Sin hallazgos. Nada que corregir.'}</p>
            : <ul className="divide-y divide-line">{visibles.map((h, i) => <Fila key={`${h.regla}-${i}`} h={h} />)}</ul>}
        </div>
      </div>

      <Evidencias res={res} />
    </section>
  )
}

function Filtro({ children, onQuitar }: { children: React.ReactNode; onQuitar: () => void }) {
  return <button onClick={onQuitar} className="ml-2 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-paper">{children}<X className="size-3" /></button>
}

function Veredicto({ res }: { res: Resultado }) {
  const { informe } = res
  const v = VEREDICTO[informe.veredicto]
  const r = informe.registros
  return (
    <div className={`rotura relative overflow-hidden rounded-2xl border-l-4 ${v.borde} border-y border-r border-y-line border-r-line bg-surface`}>
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <Etiqueta>Veredicto</Etiqueta>
          <h2 className={`mt-2 font-display text-6xl leading-none tracking-tight sm:text-7xl ${v.texto}`}>{v.titulo}</h2>
          <p className="mt-3 max-w-xl text-[15px] text-ink-2">{v.resumen}</p>
          <dl className="num mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Dato n={r.total} t="registros" sub={`${r.altas} altas · ${r.anulaciones} anul. · ${r.eventos} eventos`} />
            <Dato n={res.qrs.length} t={res.qrs.length === 1 ? 'código QR' : 'códigos QR'} />
            <Dato n={informe.porSeveridad.critica + informe.porSeveridad.alta} t="fallos" sub={`${informe.porSeveridad.critica} críticos · ${informe.porSeveridad.alta} altos`} />
            <Dato n={informe.porSeveridad.media} t="avisos" />
          </dl>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className={`grid size-36 animate-sello place-items-center rounded-full border-[3px] border-double ${v.borde} ${v.texto}`}>
            <div className="text-center">
              <div className="font-mono text-[10px] tracking-[0.2em] opacity-80">VERI*FACTU</div>
              <div className="mt-1 font-display text-xl leading-tight">{v.sello}</div>
              <div className="num mt-1 font-mono text-[10px] opacity-80">{new Date().toLocaleDateString('es-ES')}</div>
            </div>
          </div>
          <div className="num text-center font-mono text-[11px] text-muted">calculado en tu navegador<br />en {res.milisegundos} ms · 0 bytes enviados</div>
        </div>
      </div>
    </div>
  )
}

function Dato({ n, t, sub }: { n: number; t: string; sub?: string }) {
  return (
    <div>
      <dt className="sr-only">{t}</dt>
      <dd><span className="text-2xl font-semibold tracking-tight">{n}</span> <span className="text-muted">{t}</span></dd>
      {sub && <dd className="text-xs text-muted">{sub}</dd>}
    </div>
  )
}

const COLOR_SEV: Record<Severidad, string> = { critica: 'var(--fail)', alta: 'var(--fail)', media: 'var(--warn)', info: 'var(--ok)' }

/** La cadena de huellas: cada registro, su huella y si enlaza con el anterior */
function Cadena({ cadena, peor, hallazgos, seleccionado, seleccionar }: {
  cadena: Eslabon[]; peor: Map<number, Severidad>; hallazgos: Hallazgo[]; seleccionado: number | null; seleccionar: (n: number | null) => void
}) {
  const enlaceRoto = (i: number) => hallazgos.some((h) => h.registro?.indice === i && areaDeRegla(h.regla) === 'cadena' && FALLA.has(h.severidad))
  const huellaMala = (i: number) => hallazgos.some((h) => h.registro?.indice === i && areaDeRegla(h.regla) === 'huella' && FALLA.has(h.severidad))
  return (
    <div className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <Etiqueta>Cadena de registros</Etiqueta>
        <span className="no-imprimir text-xs text-muted">Pulsa un registro para ver solo sus hallazgos</span>
      </div>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface p-5">
        <ol className="flex min-w-max items-stretch">
          {cadena.map((e, i) => {
            const s = peor.get(e.indice)
            const color = s ? COLOR_SEV[s] : 'var(--ok)'
            const roto = i > 0 && enlaceRoto(e.indice)
            const activo = seleccionado === e.indice
            return (
              <li key={e.indice} className="flex items-center">
                {i > 0 && (
                  <div className="relative flex w-16 flex-col items-center" title={roto ? 'No enlaza con la huella del registro anterior' : 'Enlaza con la huella del registro anterior'}>
                    <svg viewBox="0 0 64 12" className="h-3 w-16" aria-hidden>
                      <line x1="0" y1="6" x2="64" y2="6" stroke={roto ? 'var(--fail)' : 'var(--line-strong)'} strokeWidth="2" strokeDasharray={roto ? '4 4' : undefined} />
                      {!roto && <path d="M56 2l6 4-6 4" fill="none" stroke="var(--line-strong)" strokeWidth="2" />}
                    </svg>
                    {roto && <span className="absolute top-4 grid size-5 place-items-center rounded-full bg-fail text-[10px] font-bold text-white">✕</span>}
                  </div>
                )}
                <button onClick={() => seleccionar(activo ? null : e.indice)} aria-pressed={activo}
                  className={`w-52 rounded-xl border p-3 text-left transition ${activo ? 'border-ink shadow-[0_0_0_3px_var(--line)]' : 'border-line hover:border-line-strong'}`}>
                  <div className="flex items-center justify-between">
                    <span className="num font-mono text-[11px] text-muted">#{e.indice + 1} · {e.tipo === 'anulacion' ? 'anulación' : e.tipo}</span>
                    <span className="size-2.5 rounded-full" style={{ background: color }} />
                  </div>
                  <div className="mt-1.5 truncate text-sm font-medium" title={e.etiqueta}>{e.etiqueta}</div>
                  <div className="num mt-0.5 text-xs text-muted">{e.fecha}{e.importe && ` · ${e.importe} €`}</div>
                  <div className="mt-2.5 space-y-1 border-t border-line pt-2 font-mono text-[10.5px]">
                    <div className="flex justify-between gap-2"><span className="text-muted">anterior</span><span className={roto ? 'text-fail' : 'text-ink-2'}>{e.primero ? 'primer registro' : corta(e.anterior)}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-muted">huella</span><span className={huellaMala(e.indice) ? 'text-fail' : 'text-ink-2'}>{corta(e.huella)}</span></div>
                  </div>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

/** Miniatura de la página con la caja del QR, sus rótulos y el margen exigido */
function InspectorQr({ q, hallazgos }: { q: QrAnalizado; hallazgos: Hallazgo[] }) {
  const m = q.maquetacion!
  const { pagina, qr } = m
  const lado = Math.max(qr.ancho, qr.alto)
  const rotulo = m.textos.find((t) => /qr\s*tributario/i.test(t.texto))
  const pie = m.textos.find((t) => /veri\*?factu|factura verificable/i.test(t.texto))
  const enCabecera = qr.y + qr.alto < pagina.alto * 0.4
  const medidas = [
    { t: 'Tamaño', v: `${lado.toFixed(1)} mm`, ok: lado >= 29.5 && lado <= 40.5, n: '30–40 mm' },
    { t: 'Margen libre', v: m.margenLibre === undefined ? '—' : `${m.margenLibre.toFixed(1)} mm`, ok: m.margenLibre === undefined || m.margenLibre >= 2, n: '≥ 2 mm' },
    { t: 'Corrección', v: q.nivelCorreccion ? `nivel ${q.nivelCorreccion}` : '—', ok: !q.nivelCorreccion || q.nivelCorreccion === 'M', n: 'nivel M' },
    { t: 'Posición', v: `pág. ${pagina.numero}${enCabecera ? ', arriba' : ', abajo'}`, ok: pagina.numero === 1 && enCabecera && m.esPrimerQr, n: 'pág. 1, al principio' },
    { t: '«QR tributario:»', v: rotulo ? 'presente' : 'falta', ok: Boolean(rotulo), n: 'encima del QR' },
    { t: m.verifactu ? '«VERI*FACTU»' : 'Rótulo inferior', v: pie ? 'presente' : m.verifactu ? 'falta' : 'no aplica', ok: Boolean(pie) || !m.verifactu, n: 'debajo del QR' },
  ]
  const fallos = hallazgos.filter((h) => FALLA.has(h.severidad)).length
  return (
    <div className="rotura overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium"><FileText className="size-4 shrink-0 text-muted" /><span className="truncate">{q.fuente}</span></div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${fallos ? 'bg-fail-soft text-fail' : 'bg-ok-soft text-ok'}`}>{fallos ? `${fallos} fallo${fallos > 1 ? 's' : ''}` : 'Conforme'}</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
        <div className="relative mx-auto w-full max-w-44 overflow-hidden rounded-md border border-line bg-white shadow-sm" style={{ aspectRatio: `${pagina.ancho} / ${pagina.alto}` }}>
          {q.miniatura && <img src={q.miniatura} alt={`Página ${pagina.numero} de ${q.fuente}`} className="absolute inset-0 size-full" />}
          <svg viewBox={`0 0 ${pagina.ancho} ${pagina.alto}`} className="absolute inset-0 size-full" aria-hidden>
            <rect x={qr.x - 2} y={qr.y - 2} width={qr.ancho + 4} height={qr.alto + 4} fill="none" stroke="var(--info)" strokeWidth="0.6" strokeDasharray="1.5 1.2" />
            <rect x={qr.x} y={qr.y} width={qr.ancho} height={qr.alto} fill="none" stroke={medidas[0]!.ok ? 'var(--ok)' : 'var(--fail)'} strokeWidth="1.1" />
            {rotulo && <rect x={rotulo.x - 0.6} y={rotulo.y - 0.6} width={rotulo.ancho + 1.2} height={rotulo.alto + 1.2} fill="none" stroke="var(--accent)" strokeWidth="0.6" />}
            {pie && <rect x={pie.x - 0.6} y={pie.y - 0.6} width={pie.ancho + 1.2} height={pie.alto + 1.2} fill="none" stroke="var(--accent)" strokeWidth="0.6" />}
          </svg>
        </div>
        <div className="min-w-0">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
            {medidas.map((x) => (
              <div key={x.t} className="min-w-0">
                <dt className="text-[11px] text-muted">{x.t}</dt>
                <dd className={`num flex items-center gap-1 text-sm font-medium ${x.ok ? 'text-ink' : 'text-fail'}`}>
                  {x.ok ? <Check className="size-3.5 text-ok" /> : <X className="size-3.5" />}{x.v}
                </dd>
                <dd className="text-[10.5px] text-muted">exigido: {x.n}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-muted">
            <span className="inline-flex items-center gap-1"><span className="size-2 border border-ok" />símbolo</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 border border-dashed border-info" />margen 2 mm</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 border border-accent" />rótulos</span>
          </div>
        </div>
      </div>
      <div className="border-t border-line bg-sunken/50 px-4 py-2.5"><p className="truncate font-mono text-[10.5px] text-muted" title={q.url}>{q.url}</p></div>
    </div>
  )
}

function Fila({ h }: { h: Hallazgo }) {
  const [abierto, setAbierto] = useState(false)
  const detalle = h.esperado !== undefined || h.obtenido !== undefined || h.sugerencia || h.referencia
  const s = SEV[h.severidad]
  return (
    <li className="rotura relative">
      <span className={`absolute inset-y-0 left-0 w-1 ${s.barra}`} aria-hidden />
      <button onClick={() => detalle && setAbierto(!abierto)} aria-expanded={detalle ? abierto : undefined} className={`flex w-full items-start gap-3 py-3.5 pr-4 pl-5 text-left ${detalle ? 'hover:bg-sunken/50' : 'cursor-default'}`}>
        <span className={`mt-px w-16 shrink-0 text-[11px] font-semibold ${s.texto}`}>{s.nombre}{h.noComprobado && <span className="block font-normal text-warn">sin comprobar</span>}</span>
        <span className="min-w-0 flex-1">
          <span className="text-sm leading-snug text-ink">{h.mensaje}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
            <span>{h.regla}</span>
            {h.registro && <span>#{h.registro.indice + 1} {h.registro.etiqueta}</span>}
            {h.referencia && <span className="hidden truncate font-sans sm:inline">{h.referencia}</span>}
          </span>
        </span>
        {detalle && <ChevronDown className={`no-imprimir mt-0.5 size-4 shrink-0 text-muted transition ${abierto ? 'rotate-180' : ''}`} />}
      </button>
      {abierto && (
        <div className="space-y-3 pr-4 pb-4 pl-24 text-xs">
          {(h.esperado !== undefined || h.obtenido !== undefined) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {h.esperado !== undefined && <Valor titulo="Esperado" valor={h.esperado} clase="border-ok/40 bg-ok-soft" />}
              {h.obtenido !== undefined && <Valor titulo="Obtenido" valor={h.obtenido} clase="border-fail/40 bg-fail-soft" />}
            </div>
          )}
          {h.sugerencia && <pre className="overflow-x-auto rounded-lg border border-line bg-sunken p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all">{h.sugerencia}</pre>}
          {h.referencia && <div className="text-muted">Base normativa: <span className="text-ink-2">{h.referencia}</span></div>}
        </div>
      )}
    </li>
  )
}

function Valor({ titulo, valor, clase }: { titulo: string; valor: string; clase: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <div className={`group relative rounded-lg border p-2.5 ${clase}`}>
      <div className="text-[10.5px] font-medium text-muted">{titulo}</div>
      <code className="mt-0.5 block font-mono text-[11.5px] break-all text-ink">{valor}</code>
      <button onClick={() => { void navigator.clipboard.writeText(valor); setCopiado(true); setTimeout(() => setCopiado(false), 1200) }}
        className="no-imprimir absolute top-2 right-2 rounded p-1 text-muted opacity-0 transition group-hover:opacity-100 hover:bg-surface" aria-label={`Copiar ${titulo.toLowerCase()}`}>
        {copiado ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  )
}

function Evidencias({ res }: { res: Resultado }) {
  return (
    <div className="rotura mt-10 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2"><Fingerprint className="size-4 text-muted" /><Etiqueta>Evidencia de lo analizado</Etiqueta></div>
      <p className="mt-2 text-xs text-muted">Huella SHA-256 de cada fichero, para dejar constancia de qué versión exacta se verificó (útil para el expediente de la declaración responsable).</p>
      <ul className="mt-3 divide-y divide-line">
        {res.ficheros.map((f) => (
          <li key={f.sha256 + f.nombre} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:gap-4">
            <span className="w-56 shrink-0 truncate text-sm">{f.nombre}</span>
            <span className="num w-20 shrink-0 text-xs text-muted">{(f.bytes / 1024).toFixed(1)} KB</span>
            <code className="min-w-0 font-mono text-[11px] break-all text-ink-2">{f.sha256}</code>
          </li>
        ))}
      </ul>
    </div>
  )
}
