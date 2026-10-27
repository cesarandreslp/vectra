/**
 * Correr con: npx tsx lib/contacto-calle.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { normalizarTelefono, hashTelefono, elegirResponsable, resumenContactos } from './contacto-calle'

assert.equal(normalizarTelefono('+57 300 123 4567'), '3001234567')
assert.equal(hashTelefono('+57 (300) 123-4567'), hashTelefono('3001234567')) // mismo celular, mismo hash
assert.equal(hashTelefono('12'), null)
assert.equal(hashTelefono(null), null)

assert.equal(elegirResponsable({ barrioLider: 'b', comunaLider: 'c' }), 'b')
assert.equal(elegirResponsable({ barrioLider: null, comunaLider: 'c' }), 'c')
assert.equal(elegirResponsable({ barrioLider: null, comunaLider: null }), null)

// 27-oct 20:00 hora Colombia = 28-oct 01:00 UTC: sigue siendo "hoy" el 27.
const ahora = new Date('2026-10-28T01:00:00Z')
const r = resumenContactos([
  { fecha: new Date('2026-10-27T14:00:00Z'), nombre: null,  estado: 'PENDIENTE' },  // saludo de hoy
  { fecha: new Date('2026-10-27T06:00:00Z'), nombre: 'Ana', estado: 'CONVERTIDO' }, // 1 a. m. Colombia: hoy
  { fecha: new Date('2026-10-27T04:00:00Z'), nombre: 'Luis', estado: 'INVITADO' },  // 11 p. m. del 26: ayer
  { fecha: new Date('2026-10-20T15:00:00Z'), nombre: 'Eva', estado: 'PENDIENTE' },  // hace 7 días: fuera de la semana, sin seguimiento
], ahora)
assert.deepEqual(r, { hoy: 2, semana: 3, saludos: 1, fichas: 3, convertidos: 1, sinSeguimiento: 1 })
console.log('ok')
