import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileCode2, FileText, GitBranch, Image as ImageIcon, Info, Loader2, Lock, QrCode, ShieldCheck, Upload, X, XCircle } from 'lucide-react'
import type { Hallazgo, Severidad } from '@conforma/core'
import type { Resultado } from './analisis'

const SEV: Record<Severidad, { nombre: string; clase: string; icono: ReactNode }> = {
  critica: { nombre: 'Crítico', clase: 'text-red-700 bg-red-50 ring-red-200 dark:text-red-300 dark:bg-red-950/50 dark:ring-red-900', icono: <XCircle className="size-4" /> },
  alta: { nombre: 'Alto', clase: 'text-orange-700 bg-orange-50 ring-orange-200 dark:text-orange-300 dark:bg-orange-950/40 dark:ring-orange-900', icono: <AlertTriangle className="size-4" /> },
  media: { nombre: 'Medio', clase: 'text-amber-700 bg-amber-50 ring-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:ring-amber-900', icono: <AlertTriangle className="size-4" /> },
  info: { nombre: 'Info', clase: 'text-sky-700 bg-sky-50 ring-sky-200 dark:text-sky-300 dark:bg-sky-950/40 dark:ring-sky-900', icono: <Info className="size-4" /> },
}

const EJEMPLOS = [
  { nombre: 'Lote correcto + factura correcta', ficheros: ['lote-correcto.xml', 'factura-correcta.pdf'] },
  { nombre: 'Lote manipulado + factura con errores', ficheros: ['lote-manipulado.xml', 'factura-incorrecta.pdf'] },
]

const icono = (n: string) => (/\.xml$/i.test(n) ? <FileCode2 className="size-4" /> : /\.pdf$/i.test(n) ? <FileText className="size-4" /> : <ImageIcon className="size-4" />)

export function App() {
  const [ficheros, setFicheros] = useState<File[]>([])
  const [urls, setUrls] = useState('')
  const [res, setRes] = useState<Resultado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [verInfo, setVerInfo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const ejecutar = useCallback(async (fs: File[], us: string) => {
    if (!fs.length && !us.trim()) return
    setCargando(true); setError(null)
    try {
      // El motor, pdf.js y los WASM se cargan solo al verificar: la página abre al instante
      const { analizar } = await import('./analisis')
      setRes(await analizar(fs, us.split('\n')))
    } catch (e) { setError((e as Error).message); setRes(null) } finally { setCargando(false) }
  }, [])

  const anadir = (lista: FileList | File[]) => {
    const nuevos = [...ficheros, ...Array.from(lista)].filter((f, i, a) => a.findIndex((g) => g.name === f.name && g.size === f.size) === i)
    setFicheros(nuevos)
  }

  const cargarEjemplo = async (nombres: string[]) => {
    const fs = await Promise.all(nombres.map(async (n) => new File([await (await fetch(`./ejemplos/${n}`)).blob()], n)))
    setFicheros(fs); setUrls('')
    void ejecutar(fs, '')
  }

  const descargar = () => {
    if (!res) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(res.informe, null, 2)], { type: 'application/json' }))
    a.download = 'verifactu-lint.json'
    a.click()
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-teal-700 text-white shadow-sm"><ShieldCheck className="size-5" /></div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Conforma</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">verifactu-lint</div>
          </div>
        </div>
        <a href="https://github.com/jlclosada/conforma" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800" target="_blank" rel="noreferrer">
          <GitBranch className="size-4" />GitHub
        </a>
      </header>

      <section className="py-6 sm:py-10">
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">¿Tu software de facturación cumple Verifactu?</h1>
        <p className="mt-3 max-w-2xl text-slate-600 text-pretty dark:text-slate-300">
          Arrastra los registros XML que genera tu programa y una factura en PDF. Comprobamos la huella, el encadenamiento, los esquemas oficiales de la AEAT y el código QR (tamaño, posición y textos).
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 ring-1 ring-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-900">
          <Lock className="size-3.5" />Todo se calcula en tu navegador. Ningún fichero sale de tu equipo.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); anadir(e.dataTransfer.files) }}
          className={`rounded-2xl border-2 border-dashed p-6 transition ${arrastrando ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/30' : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
        >
          <div className="flex flex-col items-center text-center">
            <Upload className="size-8 text-slate-400" />
            <p className="mt-2 font-medium">Arrastra aquí tus ficheros</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Registros XML · facturas PDF · imágenes del QR</p>
            <button onClick={() => input.current?.click()} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">Elegir ficheros</button>
            <input ref={input} type="file" multiple accept=".xml,.pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { if (e.target.files) anadir(e.target.files); e.target.value = '' }} />
          </div>
          {ficheros.length > 0 && (
            <ul className="mt-5 space-y-1.5">
              {ficheros.map((f) => (
                <li key={f.name + f.size} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
                  <span className="text-slate-500">{icono(f.name)}</span>
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(1)} KB</span>
                  <button onClick={() => setFicheros(ficheros.filter((g) => g !== f))} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700" aria-label={`Quitar ${f.name}`}><X className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <label className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <span className="flex items-center gap-1.5 text-sm font-medium"><QrCode className="size-4" />URL de un código QR (opcional)</span>
            <textarea value={urls} onChange={(e) => setUrls(e.target.value)} rows={3} placeholder="https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=…" className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Una por línea.</span>
          </label>
          <button disabled={cargando || (!ficheros.length && !urls.trim())} onClick={() => void ejecutar(ficheros, urls)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 font-medium text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40">
            {cargando ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Verificar
          </button>
          <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <div className="font-medium">¿No tienes ficheros a mano?</div>
            <div className="mt-2 flex flex-col gap-1.5">
              {EJEMPLOS.map((e) => (
                <button key={e.nombre} onClick={() => void cargarEjemplo(e.ficheros)} className="rounded-lg px-2 py-1.5 text-left text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/40">Probar: {e.nombre}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">{error}</div>}
      {res && <Informe res={res} verInfo={verInfo} setVerInfo={setVerInfo} descargar={descargar} />}

      <footer className="mt-16 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>Verificación técnica automática basada en las especificaciones públicas de la AEAT (huella v0.1.2, código QR v0.5.0 y esquemas XSD). No es una homologación de la AEAT ni sustituye al asesoramiento fiscal o legal.</p>
        <p className="mt-2">También en la línea de comandos para tu integración continua: <code className="rounded bg-slate-200/70 px-1.5 py-0.5 dark:bg-slate-800">verifactu-lint registros.xml --qr factura.pdf</code></p>
      </footer>
    </div>
  )
}

function Informe({ res, verInfo, setVerInfo, descargar }: { res: Resultado; verInfo: boolean; setVerInfo: (v: boolean) => void; descargar: () => void }) {
  const { informe } = res
  const visibles = informe.hallazgos.filter((h) => verInfo || h.severidad !== 'info')
  const grupos = useMemo(() => {
    const m = new Map<string, Hallazgo[]>()
    for (const h of visibles) {
      const k = h.registro ? `#${h.registro.indice + 1} · ${h.registro.tipo} · ${h.registro.etiqueta}` : 'Código QR, esquemas y ficheros'
      m.set(k, [...(m.get(k) ?? []), h])
    }
    return [...m.entries()]
  }, [visibles])
  const r = informe.registros

  return (
    <section className="mt-10 space-y-5">
      <div className={`flex flex-wrap items-center gap-4 rounded-2xl p-5 ring-1 ${informe.correcto ? 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900' : 'bg-red-50 ring-red-200 dark:bg-red-950/30 dark:ring-red-900'}`}>
        {informe.correcto ? <CheckCircle2 className="size-9 text-emerald-600" /> : <XCircle className="size-9 text-red-600" />}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold">{informe.correcto ? 'Sin errores críticos ni altos' : 'No cumple'}</div>
          <div className="text-sm text-slate-600 dark:text-slate-300">{r.total} registros ({r.altas} altas, {r.anulaciones} anulaciones, {r.eventos} eventos) · {res.qrs.length} código(s) QR · {res.ficheros.length} fichero(s)</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['critica', 'alta', 'media', 'info'] as Severidad[]).map((s) => (
            <span key={s} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${SEV[s].clase}`}>{SEV[s].icono}{informe.porSeveridad[s]} {SEV[s].nombre.toLowerCase()}</span>
          ))}
        </div>
      </div>

      {res.qrs.some((q) => q.maquetacion) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {res.qrs.filter((q) => q.maquetacion).map((q) => {
            const m = q.maquetacion!
            return (
              <div key={q.fuente} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                <div className="flex items-center gap-2 text-sm font-medium"><FileText className="size-4 text-slate-500" />{q.fuente}</div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Medida etiqueta="Tamaño" valor={`${m.qr.ancho.toFixed(1)} mm`} ok={m.qr.ancho >= 29.5 && m.qr.ancho <= 40.5} />
                  <Medida etiqueta="Margen" valor={`${(m.margenLibre ?? 0).toFixed(1)} mm`} ok={(m.margenLibre ?? 0) >= 2} />
                  <Medida etiqueta="Nivel" valor={q.nivelCorreccion || '—'} ok={!q.nivelCorreccion || q.nivelCorreccion === 'M'} />
                </dl>
                <p className="mt-3 truncate font-mono text-[11px] text-slate-500" title={q.url}>{q.url}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={verInfo} onChange={(e) => setVerInfo(e.target.checked)} className="accent-teal-700" />Mostrar informativos
        </label>
        <button onClick={descargar} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"><Download className="size-4" />Descargar JSON</button>
      </div>

      {grupos.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">No hay hallazgos que mostrar.</p>}
      <div className="space-y-4">
        {grupos.map(([titulo, hs]) => (
          <div key={titulo} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-medium dark:border-slate-800">{titulo}</div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">{hs.map((h, i) => <Fila key={i} h={h} />)}</ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function Medida({ etiqueta, valor, ok }: { etiqueta: string; valor: string; ok: boolean }) {
  return (
    <div className={`rounded-lg py-2 ${ok ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{etiqueta}</dt>
      <dd className={`text-sm font-semibold ${ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{valor}</dd>
    </div>
  )
}

function Fila({ h }: { h: Hallazgo }) {
  const [abierto, setAbierto] = useState(false)
  const detalle = h.esperado !== undefined || h.obtenido !== undefined || h.sugerencia || h.referencia
  return (
    <li className="px-4 py-3">
      <button onClick={() => detalle && setAbierto(!abierto)} className="flex w-full items-start gap-3 text-left">
        <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${SEV[h.severidad].clase}`}>{SEV[h.severidad].icono}{SEV[h.severidad].nombre}</span>
        <span className="min-w-0 flex-1 text-sm">{h.mensaje} <span className="font-mono text-xs text-slate-400">{h.regla}</span></span>
        {detalle && <ChevronDown className={`mt-0.5 size-4 shrink-0 text-slate-400 transition ${abierto ? 'rotate-180' : ''}`} />}
      </button>
      {abierto && (
        <div className="mt-2 space-y-1.5 pl-[4.5rem] text-xs">
          {h.esperado !== undefined && <div><span className="text-slate-500">Esperado: </span><code className="break-all">{h.esperado}</code></div>}
          {h.obtenido !== undefined && <div><span className="text-slate-500">Obtenido: </span><code className="break-all">{h.obtenido}</code></div>}
          {h.sugerencia && <pre className="overflow-x-auto rounded-lg bg-slate-50 p-2 font-mono text-[11px] whitespace-pre-wrap break-all dark:bg-slate-950">{h.sugerencia}</pre>}
          {h.referencia && <div className="text-slate-500">Referencia: {h.referencia}</div>}
        </div>
      )}
    </li>
  )
}
