/**
 * Correr con: npx tsx lib/automatizaciones-reglas.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { renderPlantilla, diaColombia, diaEleccion, tocaHoy, aplicaCambio } from './automatizaciones-reglas'

assert.equal(renderPlantilla('Hola {{nombre}}, votas en {{puesto}} {{nada}}', { nombre: 'Ana', puesto: 'Col. X' }), 'Hola Ana, votas en Col. X ')

// 11 p. m. en Colombia del 4-nov = 04:00 UTC del 5-nov: sigue siendo 4 en Colombia.
assert.equal(diaColombia(new Date('2026-11-05T04:00:00Z')), '2026-11-04')
// La configuración guarda medianoche UTC: el día es el elegido, no el anterior.
assert.equal(diaEleccion(new Date('2027-10-31T00:00:00Z')), '2027-10-31')
assert.equal(diaEleccion(new Date('2027-10-31T13:00:00Z')), '2027-10-31')

const eleccion = new Date('2027-10-31T00:00:00Z')
// Día E: desde las 7 a. m. de Colombia (12:00 UTC), no antes.
assert.equal(tocaHoy('DIA_ELECCION', null, eleccion, new Date('2027-10-31T11:59:00Z')), false)
assert.equal(tocaHoy('DIA_ELECCION', null, eleccion, new Date('2027-10-31T12:00:00Z')), true)
assert.equal(tocaHoy('DIA_ELECCION', null, eleccion, new Date('2027-11-01T12:00:00Z')), false)
// Recordatorio 3 días antes: el 28, desde las 9 a. m.
assert.equal(tocaHoy('RECORDATORIO_VOTO', { diasAntes: 3 }, eleccion, new Date('2027-10-28T14:00:00Z')), true)
assert.equal(tocaHoy('RECORDATORIO_VOTO', { diasAntes: 3 }, eleccion, new Date('2027-10-28T13:59:00Z')), false)
assert.equal(tocaHoy('RECORDATORIO_VOTO', { diasAntes: 3 }, eleccion, new Date('2027-10-29T14:00:00Z')), false)
// Sin diasAntes (o basura) = 1 día antes.
assert.equal(tocaHoy('RECORDATORIO_VOTO', { diasAntes: 'x' }, eleccion, new Date('2027-10-30T14:00:00Z')), true)
assert.equal(tocaHoy('DIA_ELECCION', null, null, new Date()), false)
assert.equal(tocaHoy('NUEVO_ELECTOR', null, eleccion, new Date('2027-10-31T14:00:00Z')), false)

assert.equal(aplicaCambio(null, 'COMPROMETIDO'), true)
assert.equal(aplicaCambio({ estado: 'COMPROMETIDO' }, 'COMPROMETIDO'), true)
assert.equal(aplicaCambio({ estado: 'COMPROMETIDO' }, 'SIMPATIZANTE'), false)

console.log('automatizaciones-reglas OK')
