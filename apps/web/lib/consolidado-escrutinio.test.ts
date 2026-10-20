/**
 * Correr con: npx tsx lib/consolidado-escrutinio.test.ts   (desde apps/web)
 * Base falsa con tres casos: mesa corregida por la comisión, mesa sin revisar
 * (cuenta con su E-14) y mesa sin E-14 digitada en la comisión.
 */
import assert from 'node:assert/strict'
import { consolidarE14 } from './consolidado-escrutinio'

const mesas = [
  { id: 'm1', number: 1, station: { name: 'Puesto A' } },
  { id: 'm2', number: 2, station: { name: 'Puesto A' } },
  { id: 'm3', number: 1, station: { name: 'Puesto B' } },
  { id: 'm4', number: 2, station: { name: 'Puesto B' } },
]
const db = {
  votingTable:     { findMany: async () => mesas },
  candidate:       { findMany: async () => [
    { id: 'c1', name: 'Ana', party: 'Partido X', isOwn: true },
    { id: 'c2', name: 'Luis', party: 'Partido X', isOwn: false },
  ] },
  e14Transmission: { findMany: async () => [
    { votingTableId: 'm1', finalData: null, manualData: [{ candidateId: 'c1', votes: 10 }, { candidateId: 'c2', votes: 5 }, { candidateId: 'votos_blanco', votes: 1 }], extractedData: null },
    { votingTableId: 'm2', finalData: [{ candidateId: 'c1', votes: 3 }], manualData: null, extractedData: null },
  ] },
  escrutinioMesa:  { findMany: async () => [
    { votingTableId: 'm1', datos: { c1: 12, c2: 5, votos_blanco: 1 }, estado: 'CORREGIDA' },
    { votingTableId: 'm3', datos: { c2: 4 }, estado: 'REVISADA' },
  ] },
}

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = await consolidarE14(db as any, 't', null)
  assert.equal(c.mesasTotales, 4)
  assert.equal(c.mesasReportadas, 2)          // m1, m2 tienen E-14
  assert.equal(c.mesasRevisadas, 2)           // m1, m3 en escrutinio
  assert.equal(c.mesasCorregidas, 1)          // m1
  assert.deepEqual(c.mesasSinReporte, [{ puesto: 'Puesto B', mesa: 2 }]) // m4: ni E-14 ni escrutinio
  const [px] = c.agrupaciones
  const ana = px.candidatos.find((k) => k.clave === 'c1')!, luis = px.candidatos.find((k) => k.clave === 'c2')!
  assert.deepEqual([ana.votosE14, ana.votos], [13, 15])   // 10+3 → 12 (corregida) + 3 (sin revisar)
  assert.deepEqual([luis.votosE14, luis.votos], [5, 9])   // 5 → 5 + 4 (m3 sin E-14)
  assert.deepEqual([px.totalE14, px.total], [18, 24])
  assert.deepEqual([c.blancoE14, c.blanco, c.totalVotosE14, c.totalVotos], [1, 1, 19, 25])
  console.log('ok')
}
main()
