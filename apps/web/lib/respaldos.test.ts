/**
 * Correr con: npx tsx lib/respaldos.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { ramasViejas } from './respaldos'

const ramas = ['main', 'respaldo-2026-11-06', 'respaldo-2026-10-30', 'respaldo-2026-10-29', 'respaldo-2026-11-01', 'respaldo-x', 'otra-2026-01-01']
// Hoy 6-nov, conservar 7 días: se borran las del 30-oct y antes.
assert.deepEqual(ramasViejas(ramas, '2026-11-06'), ['respaldo-2026-10-30', 'respaldo-2026-10-29'])
// Nunca toca la rama principal ni ramas que no son de respaldo.
assert.ok(!ramasViejas(ramas, '2030-01-01').includes('main'))
assert.ok(!ramasViejas(ramas, '2030-01-01').includes('otra-2026-01-01'))
assert.ok(!ramasViejas(ramas, '2030-01-01').includes('respaldo-x'))

console.log('respaldos OK')
