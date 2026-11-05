/**
 * Correr con: npx tsx lib/politica-datos.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { sumarDiasHabiles, diasDePlazo, politicaSugerida } from './politica-datos'

const dia = (s: string) => new Date(`${s}T15:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)

// Jueves 5-nov-2026 + 10 hábiles = jueves 19-nov (salta dos fines de semana).
assert.equal(iso(sumarDiasHabiles(dia('2026-11-05'), 10)), '2026-11-19')
// Viernes + 1 hábil = lunes.
assert.equal(iso(sumarDiasHabiles(dia('2026-11-06'), 1)), '2026-11-09')
// Sábado + 1 hábil = lunes.
assert.equal(iso(sumarDiasHabiles(dia('2026-11-07'), 1)), '2026-11-09')
// Reclamo: 15 hábiles = 3 semanas exactas desde un jueves.
assert.equal(iso(sumarDiasHabiles(dia('2026-11-05'), diasDePlazo('SUPRESION'))), '2026-11-26')
assert.equal(diasDePlazo('CONSULTA'), 10)
assert.equal(diasDePlazo('REVOCACION'), 15)

const p = politicaSugerida('Campaña Pérez', 'datos@perez.co')
for (const parte of ['RESPONSABLE', 'FINALIDADES', 'DATOS SENSIBLES', 'DERECHOS', '10 días hábiles', '15 días hábiles', 'Superintendencia', 'datos@perez.co']) {
  assert.ok(p.includes(parte), `falta: ${parte}`)
}

console.log('politica-datos OK')
