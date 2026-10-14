import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
const ej = (f) => fileURLToPath(new URL(`../../../examples/${f}`, import.meta.url))
const run = (...a) => spawnSync(process.execPath, [cli, ...a], { encoding: 'utf8' })

test('el lote correcto termina con código 0', () => {
  const r = run(ej('lote-correcto.xml'), '--json')
  assert.equal(r.status, 0)
  assert.equal(JSON.parse(r.stdout).correcto, true)
})

test('el lote manipulado termina con código 1 y señala la huella', () => {
  const r = run(ej('lote-manipulado.xml'), '--json')
  assert.equal(r.status, 1)
  const reglas = JSON.parse(r.stdout).hallazgos.map((h) => h.regla)
  assert.ok(reglas.includes('HUE-002'))
  assert.ok(reglas.includes('CAD-004'))
})

test('sin argumentos es un error de uso (código 2)', () => {
  assert.equal(run().status, 2)
})
