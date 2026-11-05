/**
 * Correr con: npx tsx lib/telegram.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { claveTelegram, secretoValido } from './telegram'
import { hashTelefono } from './contacto-calle'

assert.equal(secretoValido('abc123', 'abc123'), true)
assert.equal(secretoValido('abc124', 'abc123'), false)
assert.equal(secretoValido('abc', 'abc123'), false)   // largo distinto: no revienta
assert.equal(secretoValido(null, 'abc123'), false)
assert.equal(secretoValido('', 'abc123'), false)

// La clave de un chat nunca coincide con la de un celular con los mismos dígitos:
// si coincidiera, un chat de Telegram podría quedar pegado a la ficha de un elector.
assert.notEqual(claveTelegram('3001234567'), hashTelefono('3001234567'))
assert.equal(claveTelegram('42'), claveTelegram('42'))

console.log('telegram OK')
