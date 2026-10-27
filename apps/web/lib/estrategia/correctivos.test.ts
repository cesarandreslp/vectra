import assert from 'node:assert/strict'
import { validarPropuestas, puedeDeshacer, type Contexto, type Propuesta } from './correctivos'

const ctx: Contexto = {
  metaGlobal: 1300,
  lideres:    new Map([['L1', { targetVotes: 100 }], ['L2', { targetVotes: 0 }]]),
  personas:   new Set(['L1', 'L2', 'L3']),
  candidato:  'L9',
  comunas:    new Map([['C1', { metaVotos: 600 }], ['C2', { metaVotos: 400 }]]), // suman 1000 de 1300
  contactos:  new Map([['K1', { dias: 8, asignado: 'L1' }], ['K2', { dias: 2, asignado: null }]]),
}
const p = (x: Partial<Propuesta>): Propuesta => ({ tipo: 'AVISO', objetivo: 'L1', valor: null, destino: null, mensaje: null, motivo: 'test', ...x })
const una = (x: Partial<Propuesta>) => validarPropuestas([p(x)], ctx)[0]

// Lista cerrada
assert.equal(una({ tipo: 'BORRAR_LIDER' }).ok, false)

// META_LIDER: ±30 % o 20 votos
assert.equal(una({ tipo: 'META_LIDER', objetivo: 'L1', valor: 130 }).ok, true)
assert.equal(una({ tipo: 'META_LIDER', objetivo: 'L1', valor: 131 }).ok, false)
assert.equal(una({ tipo: 'META_LIDER', objetivo: 'L1', valor: 100 }).ok, false)   // no cambia
assert.equal(una({ tipo: 'META_LIDER', objetivo: 'L3', valor: 50 }).ok, false)    // no es líder del plan
assert.equal(una({ tipo: 'META_LIDER', objetivo: 'L1', valor: 12.5 }).ok, false)
// primera meta: techo 1,5 × 1300 / 2 = 975
assert.equal(una({ tipo: 'META_LIDER', objetivo: 'L2', valor: 975 }).ok, true)
assert.equal(una({ tipo: 'META_LIDER', objetivo: 'L2', valor: 976 }).ok, false)

// META_COMUNA: acerca la suma a la meta, no la aleja
assert.equal(una({ tipo: 'META_COMUNA', objetivo: 'C1', valor: 780 }).ok, true)   // 1180, más cerca
assert.equal(una({ tipo: 'META_COMUNA', objetivo: 'C2', valor: 300 }).ok, false)  // 900, más lejos
assert.equal(una({ tipo: 'META_COMUNA', objetivo: 'C9', valor: 300 }).ok, false)  // no existe
// la suma se acumula entre propuestas: la segunda pasaría de 1300 + holgura
const dos = validarPropuestas([
  p({ tipo: 'META_COMUNA', objetivo: 'C1', valor: 780 }),
  p({ tipo: 'META_COMUNA', objetivo: 'C2', valor: 520 }), // 1300 exacto: vale
], ctx)
assert.deepEqual(dos.map((r) => r.ok), [true, true])
const sobra = validarPropuestas([
  p({ tipo: 'META_COMUNA', objetivo: 'C1', valor: 780 }),
  p({ tipo: 'META_COMUNA', objetivo: 'C1', valor: 700 }), // mismo objetivo dos veces
], ctx)
assert.deepEqual(sobra.map((r) => r.ok), [true, false])

// REASIGNAR_CONTACTO: 5 días mínimo y destino válido
assert.equal(una({ tipo: 'REASIGNAR_CONTACTO', objetivo: 'K1', destino: 'L2' }).ok, true)
assert.equal(una({ tipo: 'REASIGNAR_CONTACTO', objetivo: 'K2', destino: 'L2' }).ok, false) // 2 días
assert.equal(una({ tipo: 'REASIGNAR_CONTACTO', objetivo: 'K1', destino: 'L1' }).ok, false) // ya es suyo
assert.equal(una({ tipo: 'REASIGNAR_CONTACTO', objetivo: 'K1', destino: 'X' }).ok, false)

// AVISO: destino válido y largo
assert.equal(una({ objetivo: 'CANDIDATO', mensaje: 'Visita la comuna 3 el sábado' }).ok, true)
assert.equal(una({ objetivo: 'L7', mensaje: 'hola' }).ok, false)
assert.equal(una({ objetivo: 'L1', mensaje: 'x'.repeat(141) }).ok, false)

// Tope semanal: 21 avisos → el último se rechaza
const avisos = validarPropuestas(Array.from({ length: 21 }, () => p({ mensaje: 'tarea' })), ctx)
assert.equal(avisos.filter((r) => r.ok).length, 20)

// Deshacer solo si nadie lo cambió después
assert.equal(puedeDeshacer(130, 130), true)
assert.equal(puedeDeshacer(150, 130), false)
assert.equal(puedeDeshacer(null, undefined), true)

console.log('correctivos ok')
