import { cpSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const require = createRequire(import.meta.url)

/** Copia las fuentes estándar de pdf.js para dibujar las facturas sin pedir nada a un CDN */
function fuentesPdf(): Plugin {
  return {
    name: 'fuentes-pdfjs',
    buildStart() {
      const origen = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')
      const destino = join(import.meta.dirname, 'public', 'standard_fonts')
      if (!existsSync(destino)) cpSync(origen, destino, { recursive: true })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), fuentesPdf()],
  base: './',
  optimizeDeps: { exclude: ['xmllint-wasm', 'zxing-wasm'] },
  worker: { format: 'es' },
  build: { target: 'es2022' },
})
