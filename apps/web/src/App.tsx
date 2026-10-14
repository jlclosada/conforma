import { useCallback, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, FileCode2, FileText, GitBranch, Image as ImageIcon, Loader2, Lock, Plus, QrCode, ShieldCheck, Terminal, Upload, X } from 'lucide-react'
import { AREAS } from '@conforma/core'
import type { Resultado } from './analisis'
import { Informe } from './Informe'
import { AREA, Etiqueta, Logo, TituloSeccion } from './ui'

const REPO = 'https://github.com/jlclosada/conforma'
// Contacto provisional para pilotos: un issue en el repositorio
const CONTACTO = `${REPO}/issues/new?title=Piloto%20de%20auditor%C3%ADa%20Verifactu`

const EJEMPLOS = [
  { nombre: 'Lote oficial de la AEAT', detalle: '3 registros + factura PDF bien maquetada', ficheros: ['lote-correcto.xml', 'factura-correcta.pdf'], tono: 'bg-ok' },
  { nombre: 'Lote manipulado', detalle: 'importe alterado, cadena rota y QR mal impreso', ficheros: ['lote-manipulado.xml', 'factura-incorrecta.pdf'], tono: 'bg-fail' },
]

const icono = (n: string) => (/\.xml$/i.test(n) ? FileCode2 : /\.pdf$/i.test(n) ? FileText : ImageIcon)

export function App() {
  const [ficheros, setFicheros] = useState<File[]>([])
  const [urls, setUrls] = useState('')
  const [verUrl, setVerUrl] = useState(false)
  const [res, setRes] = useState<Resultado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const ejecutar = useCallback(async (fs: File[], us: string) => {
    if (!fs.length && !us.trim()) return
    setCargando(true); setError(null)
    try {
      // El motor, pdf.js y los WASM se cargan solo al verificar: la página abre al instante
      const { analizar } = await import('./analisis')
      setRes(await analizar(fs, us.split('\n')))
      requestAnimationFrame(() => document.getElementById('informe')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (e) { setError((e as Error).message); setRes(null) } finally { setCargando(false) }
  }, [])

  const anadir = (lista: FileList | File[]) =>
    setFicheros((prev) => [...prev, ...Array.from(lista)].filter((f, i, a) => a.findIndex((g) => g.name === f.name && g.size === f.size) === i))

  const cargarEjemplo = async (nombres: string[]) => {
    const fs = await Promise.all(nombres.map(async (n) => new File([await (await fetch(`./ejemplos/${n}`)).blob()], n)))
    setFicheros(fs); setUrls('')
    void ejecutar(fs, '')
  }

  const listo = ficheros.length > 0 || urls.trim().length > 0

  return (
    <div className="min-h-dvh">
      <header className="no-imprimir sticky top-0 z-30 border-b border-line/70 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#" className="flex items-center gap-2.5">
            <Logo className="size-7" />
            <span className="text-[15px] font-semibold tracking-tight">Conforma</span>
            <span className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-muted sm:inline">verifactu-lint 0.1</span>
          </a>
          <nav className="flex items-center gap-1 text-sm text-ink-2">
            <a href="#comprueba" className="hidden rounded-lg px-3 py-1.5 hover:bg-sunken md:inline">Qué comprueba</a>
            <a href="#ci" className="hidden rounded-lg px-3 py-1.5 hover:bg-sunken md:inline">CLI y CI</a>
            <a href="#fabricantes" className="hidden rounded-lg px-3 py-1.5 hover:bg-sunken md:inline">Para fabricantes</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 hover:bg-sunken"><GitBranch className="size-4" /><span className="hidden sm:inline">GitHub</span></a>
          </nav>
        </div>
      </header>

      <main>
        <section className="no-imprimir relative">
          <div className="papel-milimetrado pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-14 pb-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-20">
            <div className="animate-entrar">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2">
                <span className="size-1.5 rounded-full bg-accent" />Especificaciones AEAT · huella v0.1.2 · QR v0.5.0
              </span>
              <h1 className="mt-6 font-display text-[3.4rem] leading-[0.95] tracking-tight text-balance sm:text-7xl">
                Comprueba tu Verifactu <em className="text-accent">antes</em> que Hacienda.
              </h1>
              <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-ink-2 text-pretty">
                Suelta los registros XML que genera tu programa y una factura en PDF. Recalculamos cada huella, seguimos la cadena, validamos contra los esquemas oficiales y medimos el QR impreso al milímetro.
              </p>
              <ul className="mt-8 grid max-w-lg grid-cols-3 divide-x divide-line border-y border-line">
                {[['39', 'reglas con base normativa'], ['3', 'esquemas XSD oficiales'], ['0', 'bytes enviados a ningún servidor']].map(([n, t]) => (
                  <li key={t} className="px-4 py-4 first:pl-0">
                    <div className="num font-display text-4xl leading-none">{n}</div>
                    <div className="mt-1.5 text-xs leading-snug text-muted">{t}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="animate-entrar [animation-delay:120ms]">
              <div className="rounded-[1.25rem] border border-line bg-surface p-2 shadow-[0_1px_0_var(--line),0_24px_48px_-24px_rgba(0,0,0,0.18)]">
                <div
                  onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={(e) => { e.preventDefault(); setArrastrando(false); anadir(e.dataTransfer.files) }}
                  className={`rounded-2xl border-[1.5px] border-dashed p-5 transition ${arrastrando ? 'border-accent bg-accent-soft' : 'border-line-strong bg-sunken/50'}`}
                >
                  {ficheros.length === 0 ? (
                    <button onClick={() => input.current?.click()} className="flex w-full flex-col items-center py-8 text-center">
                      <span className="grid size-12 place-items-center rounded-xl border border-line bg-surface shadow-sm"><Upload className="size-5 text-ink-2" /></span>
                      <span className="mt-4 font-medium">Arrastra tus ficheros o <span className="text-accent underline decoration-accent/40 underline-offset-4">elígelos</span></span>
                      <span className="mt-1 text-sm text-muted">Registros XML · facturas PDF · imágenes del QR</span>
                    </button>
                  ) : (
                    <div>
                      <ul className="space-y-1.5">
                        {ficheros.map((f) => {
                          const I = icono(f.name)
                          return (
                            <li key={f.name + f.size} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
                              <I className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
                              <span className="min-w-0 flex-1 truncate">{f.name}</span>
                              <span className="num font-mono text-[11px] text-muted">{(f.size / 1024).toFixed(1)} KB</span>
                              <button onClick={() => setFicheros(ficheros.filter((g) => g !== f))} className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink" aria-label={`Quitar ${f.name}`}><X className="size-3.5" /></button>
                            </li>
                          )
                        })}
                      </ul>
                      <button onClick={() => input.current?.click()} className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted hover:text-ink"><Plus className="size-4" />Añadir más</button>
                    </div>
                  )}
                  <input ref={input} type="file" multiple accept=".xml,.pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { if (e.target.files) anadir(e.target.files); e.target.value = '' }} />
                </div>

                <div className="px-3 pt-3">
                  {verUrl ? (
                    <label className="block">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-ink-2"><QrCode className="size-3.5" />URL leída de un QR, una por línea</span>
                      <textarea autoFocus value={urls} onChange={(e) => setUrls(e.target.value)} rows={2} placeholder="https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=…" className="mt-1.5 w-full resize-y rounded-lg border border-line bg-sunken/50 px-3 py-2 font-mono text-[11.5px] outline-none placeholder:text-muted focus:border-accent" />
                    </label>
                  ) : (
                    <button onClick={() => setVerUrl(true)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"><QrCode className="size-3.5" />¿Solo tienes la URL del QR? Pégala</button>
                  )}
                </div>

                <div className="p-3">
                  <button disabled={cargando || !listo} onClick={() => void ejecutar(ficheros, urls)} className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink font-medium text-paper transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30">
                    {cargando ? <><Loader2 className="size-4 animate-spin" />Verificando…</> : <><ShieldCheck className="size-4" />Verificar<ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></>}
                  </button>
                  <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11.5px] text-muted"><Lock className="size-3" />Se procesa en tu navegador. Nada sale de tu equipo.</p>
                </div>
              </div>

              <div className="mt-4">
                <Etiqueta className="px-1">O prueba con un ejemplo</Etiqueta>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {EJEMPLOS.map((e) => (
                    <button key={e.nombre} disabled={cargando} onClick={() => void cargarEjemplo(e.ficheros)} className="group flex items-start gap-3 rounded-xl border border-line bg-surface/70 p-3 text-left transition hover:border-line-strong hover:bg-surface disabled:opacity-50">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${e.tono}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{e.nombre}</span>
                        <span className="block text-xs text-muted">{e.detalle}</span>
                      </span>
                      <ArrowUpRight className="size-4 shrink-0 text-muted transition group-hover:text-ink" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && <div className="mx-auto mt-8 max-w-6xl px-4 sm:px-6"><div className="rounded-xl border border-fail/30 bg-fail-soft p-4 text-sm text-fail">{error}</div></div>}
        {res && <Informe res={res} />}

        <section id="comprueba" className="no-imprimir mx-auto mt-28 max-w-6xl px-4 sm:px-6">
          <TituloSeccion etiqueta="Qué comprueba" titulo={<>Seis frentes donde un programa <em>suele</em> fallar.</>}>
            Cada regla cita el artículo de la Orden HAC/1177/2024 o el documento técnico de la AEAT en que se apoya. Si algo no se puede comprobar, el veredicto lo dice: nunca da por bueno lo que no ha mirado.
          </TituloSeccion>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {AREAS.map((a, i) => {
              const I = AREA[a].icono
              return (
                <div key={a} className="bg-surface p-6">
                  <div className="flex items-center justify-between">
                    <I className="size-5 text-accent" strokeWidth={1.6} />
                    <span className="num font-mono text-[11px] text-muted">0{i + 1}</span>
                  </div>
                  <h3 className="mt-6 text-[15px] font-semibold">{AREA[a].nombre}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{AREA[a].detalle}.</p>
                </div>
              )
            })}
          </div>
          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            {[['Aprobado', 'Todo lo aportado se ha comprobado y no hay fallos.', 'bg-ok'], ['Falla', 'Al menos un hallazgo crítico o alto.', 'bg-fail'], ['No comprobado', 'Sin fallos, pero algo no se pudo verificar.', 'bg-warn']].map(([t, d, c]) => (
              <div key={t} className="flex items-start gap-3 rounded-xl border border-line p-4">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${c}`} />
                <div><div className="font-medium">{t}</div><div className="text-muted">{d}</div></div>
              </div>
            ))}
          </div>
        </section>

        <section id="ci" className="no-imprimir mx-auto mt-28 max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <TituloSeccion etiqueta="Línea de comandos e integración continua" titulo="Que ninguna versión salga sin pasar el control.">
              El mismo motor, en tu terminal y en cada pull request. Salida en texto, JSON o SARIF para GitHub code scanning, y códigos de salida distintos para «falla» y «no comprobado».
            </TituloSeccion>
            <div className="overflow-hidden rounded-2xl border border-line bg-[#111316] text-[#d8dbe0] shadow-[0_24px_48px_-24px_rgba(0,0,0,0.35)]">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
                <Terminal className="size-3.5 text-white/50" /><span className="font-mono text-[11px] text-white/50">terminal</span>
                <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/60">pronto en npm</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed">
                <span className="text-white/40">$ </span>verifactu-lint registros.xml --qr factura.pdf{'\n'}
                <span className="text-white/50">verifactu-lint · 1 fichero(s) · 3 registro(s)</span>{'\n\n'}
                <span className="text-[#ff7a63]">#2 alta 12345679/G34</span>{'\n'}
                {'  '}<span className="text-[#ff7a63]">✖ CRÍTICO</span> <span className="text-white/40">HUE-002</span>  La huella no coincide{'\n'}
                {'  '}<span className="text-[#ff7a63]">● ALTO</span>    <span className="text-white/40">QR-010</span>   El QR mide 24 × 24 mm{'\n\n'}
                <span className="text-white/50">Cobertura:</span> <span className="text-[#3ccb9e]">✔ formatos</span> <span className="text-[#ff7a63]">✖ huella</span> <span className="text-[#3ccb9e]">✔ XSD</span>{'\n'}
                <span className="font-semibold text-[#ff7a63]">✖ FALLA</span>  <span className="text-white/40">exit 1</span>
              </pre>
            </div>
          </div>
        </section>

        <section id="fabricantes" className="no-imprimir mx-auto mt-28 max-w-6xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-[1.5rem] bg-ink text-paper">
            <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <Etiqueta className="text-paper/60">Para fabricantes de software</Etiqueta>
                <h2 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">La declaración responsable la firmas tú. <em className="text-accent">Que no sea a ciegas.</em></h2>
                <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-paper/70">
                  Verifactu no tiene homologación oficial: el fabricante declara que cumple y responde con hasta 150.000 € por ejercicio. Esta herramienta mira lo que le das; una auditoría mira cómo se comporta tu sistema.
                </p>
                <a href={CONTACTO} target="_blank" rel="noreferrer" className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-paper px-5 text-sm font-medium text-ink transition hover:opacity-90">Solicitar un piloto de auditoría<ArrowRight className="size-4" /></a>
              </div>
              <ol className="space-y-px overflow-hidden rounded-2xl border border-paper/10">
                {[
                  ['Corpus de casos límite', 'Rectificativas R1–R5, simplificadas, anulaciones, subsanaciones, cambio de hora, «/» en el número, primer registro tras una caída.'],
                  ['Pruebas sobre tu implementación', 'Ejecutamos el corpus contra tu sistema y revisamos facturas impresas reales, no solo el XML.'],
                  ['Informe con evidencias', 'Qué se probó, con qué versión y con qué resultado, con la huella de cada fichero. Para tu expediente y para tus clientes.'],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4 bg-paper/[0.04] p-5">
                    <span className="num font-mono text-xs text-accent">0{i + 1}</span>
                    <div><div className="text-sm font-medium">{t}</div><div className="mt-1 text-sm leading-relaxed text-paper/60">{d}</div></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="no-imprimir mx-auto mt-28 max-w-6xl px-4 sm:px-6">
          <TituloSeccion etiqueta="Preguntas" titulo="Lo que nos suelen preguntar." />
          <div className="mt-8 divide-y divide-line border-y border-line">
            {[
              ['¿Subís mis ficheros a algún sitio?', 'No. Todo se ejecuta en tu navegador con WebAssembly: el motor, libxml2 para el XSD, pdf.js para la factura y el lector de QR. Puedes desconectarte de internet después de abrir la página y seguirá funcionando.'],
              ['¿Es una certificación oficial?', 'No. La AEAT no homologa programas. Es una verificación técnica independiente basada en las especificaciones públicas, útil como evidencia, pero no sustituye a tu declaración responsable ni al asesoramiento fiscal.'],
              ['¿Por qué puede salir «no comprobado»?', 'Porque preferimos no dar por bueno lo que no hemos mirado: si un fichero no se puede validar contra el XSD, o un QR no corresponde a ningún registro aportado, el resultado no puede ser «aprobado».'],
              ['¿Sirve para el modo NO VERI*FACTU?', 'En parte: verifica la huella y el encadenamiento de los eventos. La firma XAdES de cada registro todavía no se comprueba.'],
            ].map(([p, r]) => (
              <details key={p} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium">{p}<Plus className="size-4 shrink-0 text-muted transition group-open:rotate-45" /></summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{r}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="no-imprimir mx-auto mt-28 max-w-6xl border-t border-line px-4 py-10 text-xs text-muted sm:px-6">
        <div className="flex flex-col justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2"><Logo className="size-5" /><span className="font-medium text-ink">Conforma</span><span>· código abierto, Apache-2.0</span></div>
          <p className="max-w-xl">Basado en el RD 1007/2023, la Orden HAC/1177/2024 y los documentos técnicos de la AEAT (huella v0.1.2, QR v0.5.0, esquemas XSD). No es una homologación de la AEAT ni sustituye al asesoramiento fiscal o legal.</p>
        </div>
      </footer>
    </div>
  )
}
