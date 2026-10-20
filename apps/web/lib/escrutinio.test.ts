/**
 * Correr con: npx tsx lib/escrutinio.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { votosDeE14, diferencias, totalVotos, datosDeTransmision } from './escrutinio'

const candidatos = [{ id: 'c1', name: 'Ana Pérez' }, { id: 'c2', name: 'Luis Gómez' }]

// Mezcla de claves: id, nombre (transmisión vieja), blanco/nulos en mayúsculas, y basura que se ignora.
const v = votosDeE14([
  { candidateId: 'c1', votes: 10 }, { candidateId: 'luis gómez', votes: 4 },
  { candidateId: 'VOTOS_BLANCO', votes: 2 }, { candidateId: 'votos_nulos', votes: 1 },
  { candidateId: 'desconocido', votes: 99 },
], candidatos)!
assert.deepEqual(v, { c1: 10, c2: 4, votos_blanco: 2, votos_nulos: 1 })
assert.equal(totalVotos(v), 17)
assert.equal(votosDeE14(null, candidatos), null)

assert.deepEqual(diferencias(v, { ...v, c1: 12, votos_nulos: 0 }), [
  { clave: 'c1', antes: 10, despues: 12 }, { clave: 'votos_nulos', antes: 1, despues: 0 },
])
assert.deepEqual(diferencias({ c1: 3 }, { c1: 3 }), [])

assert.deepEqual(datosDeTransmision({ finalData: null, manualData: [{ candidateId: 'c1', votes: 1 }], extractedData: [] }), [{ candidateId: 'c1', votes: 1 }])
console.log('ok')
