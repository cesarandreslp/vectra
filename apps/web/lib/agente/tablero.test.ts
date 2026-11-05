/**
 * Correr con: npx tsx lib/agente/tablero.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { resumirTablero, type ConvTablero } from './tablero'

const ahora = new Date('2026-11-10T12:00:00Z')
const base: ConvTablero = {
  autorizo: false, pendiente: false, escalada: false, registrada: false, elector: false,
  comprometido: false, voluntario: false, comunaId: null, temas: [], creada: ahora,
}
const r = resumirTablero([
  // Escribe 3 veces de vías: cuenta UNA persona.
  { ...base, comunaId: 'c1', temas: ['vias', 'vias', 'vias', 'seguridad'], autorizo: true, registrada: true },
  { ...base, comunaId: 'c1', temas: ['seguridad'], autorizo: true, registrada: true, elector: true, comprometido: true, voluntario: true },
  { ...base, comunaId: 'c2', temas: ['empleo', 'otro'], pendiente: true, escalada: true },
  { ...base, temas: ['salud'], creada: new Date('2026-10-01T00:00:00Z') }, // sin zona y vieja
], ahora)

assert.equal(r.conversaciones, 4)
assert.equal(r.ultimos7, 3)
assert.equal(r.autorizaron, 2)
assert.equal(r.pendientes, 1)
assert.equal(r.voluntarios, 1)
assert.deepEqual(r.embudo.map((e) => e.n), [4, 2, 2, 1, 1])
assert.deepEqual(r.temas, [{ tema: 'seguridad', n: 2 }, { tema: 'empleo', n: 1 }, { tema: 'salud', n: 1 }, { tema: 'vias', n: 1 }]) // "otro" no cuenta
assert.deepEqual(r.porComuna.map((z) => [z.comunaId, z.personas]), [['c1', 2], ['c2', 1], [null, 1]]) // sin zona, al final
assert.deepEqual(r.porComuna[0].temas[0], { tema: 'seguridad', n: 2 })
assert.deepEqual(resumirTablero([], ahora).porComuna, [])

console.log('agente/tablero OK')
