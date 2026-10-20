/**
 * Correr con: npx tsx "app/(tenant)/core/reportes/_components/filtrar-reporte.test.ts"   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { columnasFiltrables, aplicarFiltro, totalesFiltrados } from './filtrar-reporte'
const r = {
  titulo: 't', descripcion: '', columnas: ['Elector', 'Líder', 'Estado', 'Votos'],
  filas: [['Ana', 'José', 'Voto seguro', 3], ['Luis', 'Daniela', 'Simpatizante', 1], ['María', 'José', 'Voto seguro', 2], ['Óscar', 'Daniela', 'Voto seguro', 5]],
  totales: ['Total', '', '', 11],
}
assert.deepEqual(columnasFiltrables(r).map((c) => c.indice), [1, 2]) // nombres únicos y números no
assert.deepEqual(aplicarFiltro(r.filas, { texto: 'oscar', columnas: {}, orden: null }).map((f) => f[0]), ['Óscar']) // sin tildes
const jose = aplicarFiltro(r.filas, { texto: '', columnas: { 1: 'José' }, orden: { indice: 3, asc: false } })
assert.deepEqual(jose.map((f) => f[0]), ['Ana', 'María'])
assert.deepEqual(totalesFiltrados(r, jose), ['Total (filtrado)', '', '', 5])
console.log('ok')
