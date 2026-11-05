/**
 * Correr con: npx tsx lib/autorizacion-datos.test.ts   (desde apps/web)
 * El texto sugerido no puede perder lo que exige la Ley 1581 / Decreto 1377.
 */
import assert from 'node:assert/strict'
import { textoSugerido } from './autorizacion-datos'

const t = textoSugerido('Campaña Pérez', 'datos@perez.co')
assert.ok(t.includes('Campaña Pérez'), 'nombra al responsable')
assert.ok(t.includes('responsable del tratamiento'))
assert.ok(/cédula/.test(t) && /celular/.test(t), 'dice qué datos se recogen')
assert.ok(/para informarme/.test(t), 'dice la finalidad')
assert.ok(/dato sensible/.test(t) && /no\s+estoy obligado/.test(t), 'avisa que la afinidad política es sensible y opcional')
assert.ok(/suprimir/.test(t) && /revocar/.test(t), 'informa los derechos')
assert.ok(t.includes('datos@perez.co'), 'dice dónde ejercerlos')
assert.ok(textoSugerido('X', null).includes('comunicándome con la campaña'))

console.log('autorizacion-datos OK')
