/**
 * Correr con: npx tsx "app/(tenant)/core/estructura/_lib/cargos.test.ts"   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { plantillaPara, plazas, validarCargo } from './cargos'

const concejal = plantillaPara('CONCEJAL')
assert.equal(concejal.length, 7)
assert.equal(plantillaPara(null), concejal) // sin plantilla propia cae a la de concejo
const lider = concejal.find((c) => c.clave === 'LIDER_ZONA')!
assert.equal(plazas(lider, 14), 14)
assert.equal(plazas(concejal[0], 14), 1)

assert.equal(validarCargo('VACANTE', null, null), null)
assert.equal(validarCargo('CONVERSACION', null, null), null)
assert.equal(validarCargo('CONVERSACION', 'v1', null), null)
assert.equal(validarCargo('ASIGNADO', null, 'u1'), null)
assert.ok(validarCargo('ASIGNADO', null, null))
assert.ok(validarCargo('VACANTE', 'v1', null))
assert.ok(validarCargo('ASIGNADO', 'v1', 'u1'))
assert.ok(validarCargo('OTRO', null, null))
console.log('cargos ok')
