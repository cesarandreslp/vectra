/**
 * Correr con: npx tsx lib/cifra-repartidora.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { asignarCurules } from './cifra-repartidora'

// 5 curules, 10.000 votos válidos (9.500 por listas + 500 en blanco):
// cociente 2.000, umbral 1.000 → D queda por fuera con 900.
const r = asignarCurules([
  { nombre: 'A', votos: 4200 }, { nombre: 'B', votos: 2600 },
  { nombre: 'C', votos: 1800 }, { nombre: 'D', votos: 900 },
], 500, 5)
assert.equal(r.votosValidos, 10000)
assert.equal(r.cociente, 2000)
assert.equal(r.umbral, 1000)
// Cocientes ordenados: 4200 (A), 2600 (B), 2100 (A/2), 1800 (C), 1400 (A/3) → el 5.º es la cifra.
assert.equal(r.cifraRepartidora, 1400)
const curules = Object.fromEntries(r.agrupaciones.map((g) => [g.nombre, g.curules]))
assert.deepEqual(curules, { A: 3, B: 1, C: 1, D: 0 }) // 5 curules repartidas
assert.equal(r.agrupaciones.find((g) => g.nombre === 'D')!.superaUmbral, false)

// 3 curules, A 600 B 300 C 100 (+0 blanco): cociente 333,3, umbral 166,7 → C fuera.
const c = asignarCurules([{ nombre: 'A', votos: 600 }, { nombre: 'B', votos: 300 }, { nombre: 'C', votos: 100 }], 0, 3)
assert.equal(c.cifraRepartidora, 300) // cocientes 600, 300(A/2), 300(B) → 3.º = 300
assert.deepEqual(c.agrupaciones.map((g) => [g.nombre, g.curules]), [['A', 2], ['B', 1], ['C', 0]])
assert.equal(c.empateUltimaCurul, false) // 3 curules repartidas, el 4.º cociente (A/3 = 200) es menor

// Empate real en la última curul: 1 curul, A 400 B 400.
const e = asignarCurules([{ nombre: 'A', votos: 400 }, { nombre: 'B', votos: 400 }], 0, 1)
assert.equal(e.empateUltimaCurul, true)

assert.throws(() => asignarCurules([], 0, 0))
console.log('ok')
