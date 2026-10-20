/**
 * Los votos del E-26 van en números y en letras: un error aquí es un acta mal
 * transcrita. Correr con: npx tsx lib/numero-a-letras.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { numeroALetras } from './numero-a-letras'

const casos: [number, string][] = [
  [0, 'cero'], [1, 'uno'], [15, 'quince'], [16, 'dieciséis'], [21, 'veintiuno'], [22, 'veintidós'],
  [30, 'treinta'], [31, 'treinta y uno'], [99, 'noventa y nueve'], [100, 'cien'], [101, 'ciento uno'],
  [121, 'ciento veintiuno'], [500, 'quinientos'], [999, 'novecientos noventa y nueve'],
  [1000, 'mil'], [1001, 'mil uno'], [1200, 'mil doscientos'], [2021, 'dos mil veintiuno'],
  [21000, 'veintiún mil'], [31000, 'treinta y un mil'], [101000, 'ciento un mil'], [109000, 'ciento nueve mil'],
  [1_000_000, 'un millón'], [2_500_000, 'dos millones quinientos mil'], [21_000_001, 'veintiún millones uno'],
]
for (const [n, esperado] of casos) assert.equal(numeroALetras(n), esperado, `numeroALetras(${n})`)
assert.throws(() => numeroALetras(-1))
assert.throws(() => numeroALetras(1.5))
console.log(`ok — ${casos.length} casos`)
