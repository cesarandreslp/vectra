/**
 * Correr con: npx tsx lib/meta-votos.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { compromisosParaMeta, avanceMeta, descuadreMetas } from './meta-votos'

assert.equal(compromisosParaMeta(100, 0.2), 125)
assert.equal(compromisosParaMeta(1300, 0.2), 1625) // la misma cifra que la cascada
assert.equal(avanceMeta(100, 100, 0.2), 80)        // 100 compromisos rinden 80 votos: no es el 100 %
assert.equal(avanceMeta(125, 100, 0.2), 100)
assert.equal(avanceMeta(50, null, 0.2), 0)
assert.equal(descuadreMetas(1300, 1300), null)
assert.equal(descuadreMetas(1300, 0), null)
assert.match(descuadreMetas(1300, 1200)!, /faltan 100/)
assert.match(descuadreMetas(1300, 1400)!, /100 más/)
console.log('ok')
