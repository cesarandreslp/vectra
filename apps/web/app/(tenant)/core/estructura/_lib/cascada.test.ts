/**
 * Correr con: npx tsx "app/(tenant)/core/estructura/_lib/cascada.test.ts"   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { calcularCascada } from './cascada'

const f = { tasaFuga: 0.2, tasaConversion: 0.4, compromisosPorMultiplicador: 12, multiplicadoresPorLider: 10 }
assert.deepEqual(calcularCascada(1300, f), { compromisos: 1625, contactos: 4063, multiplicadores: 136, lideres: 14 })
assert.deepEqual(calcularCascada(1, f), { compromisos: 2, contactos: 5, multiplicadores: 1, lideres: 1 }) // ceil en cada paso
console.log('ok')
