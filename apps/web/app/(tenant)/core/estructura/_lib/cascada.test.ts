/**
 * Correr con: npx tsx "app/(tenant)/core/estructura/_lib/cascada.test.ts"   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { calcularCascada, esperadoHoy, estadoNivel } from './cascada'

const f = { tasaFuga: 0.2, tasaConversion: 0.4, compromisosPorMultiplicador: 12, multiplicadoresPorLider: 10 }
assert.deepEqual(calcularCascada(1300, f), { compromisos: 1625, contactos: 4063, multiplicadores: 136, lideres: 14 })
assert.deepEqual(calcularCascada(1, f), { compromisos: 2, contactos: 5, multiplicadores: 1, lideres: 1 }) // ceil en cada paso

// Hitos: interpolación lineal desde ceros en el inicio, entre hitos, y tope en el último.
const h = (fecha: string, contactos: number) => ({ fecha: new Date(fecha), contactos, compromisos: contactos / 10, multiplicadores: 0, lideres: 0 })
const hitos = [h('2027-01-11', 1000), h('2027-01-21', 2000)]
const inicio = new Date('2027-01-01')
assert.equal(esperadoHoy(hitos, inicio, new Date('2027-01-06')).esperado?.contactos, 500)
assert.equal(esperadoHoy(hitos, inicio, new Date('2027-01-06')).proximo, hitos[0])
assert.equal(esperadoHoy(hitos, inicio, new Date('2027-01-16')).esperado?.contactos, 1500)
assert.equal(esperadoHoy(hitos, inicio, new Date('2027-01-11')).esperado?.contactos, 1000) // el día del hito
assert.deepEqual(esperadoHoy(hitos, inicio, new Date('2027-02-01')), { proximo: null, esperado: { contactos: 2000, compromisos: 200, multiplicadores: 0, lideres: 0 } })
assert.deepEqual(esperadoHoy([], inicio, inicio), { proximo: null, esperado: null })
assert.equal(estadoNivel(89, 100), 'atrasado')
assert.equal(estadoNivel(90, 100), 'a tiempo')
assert.equal(estadoNivel(110, 100), 'a tiempo')
assert.equal(estadoNivel(111, 100), 'adelantado')
assert.equal(estadoNivel(0, 0), 'a tiempo')
console.log('ok')
