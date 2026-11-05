/**
 * Correr con: npx tsx packages/auth/src/totp.test.ts   (desde la raíz)
 * Vectores oficiales del RFC 6238, apéndice B (SHA1, secreto "12345678901234567890").
 */
import assert from 'node:assert/strict'
import { base32, desdeBase32, codigoTotp, verificarTotp, nuevoSecreto, uriTotp } from './totp'

const secreto = base32(Buffer.from('12345678901234567890'))
assert.equal(secreto, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
assert.equal(desdeBase32(secreto).toString(), '12345678901234567890')

// RFC 6238: códigos de 8 dígitos; los nuestros son los 6 últimos.
for (const [t, ocho] of [[59, '94287082'], [1111111109, '07081804'], [1234567890, '89005924'], [2000000000, '69279037']] as const) {
  assert.equal(codigoTotp(secreto, t * 1000), ocho.slice(-6), `t=${t}`)
}

const ahora = 1_800_000_000_000
const actual = codigoTotp(secreto, ahora)
assert.equal(verificarTotp(secreto, actual, ahora), true)
assert.equal(verificarTotp(secreto, actual, ahora + 30_000), true)   // reloj 30 s adelantado: se acepta
assert.equal(verificarTotp(secreto, actual, ahora + 90_000), false)  // 90 s: no
assert.equal(verificarTotp(secreto, '123 456'.replace('123 456', actual.slice(0, 3) + ' ' + actual.slice(3)), ahora), true) // con espacio
assert.equal(verificarTotp(secreto, '12345', ahora), false)
assert.equal(verificarTotp(secreto, 'abcdef', ahora), false)

assert.equal(desdeBase32(nuevoSecreto()).length, 20)
assert.ok(uriTotp(secreto, 'ana@x.co').startsWith('otpauth://totp/Vectra:ana%40x.co?secret='))

console.log('totp OK')
