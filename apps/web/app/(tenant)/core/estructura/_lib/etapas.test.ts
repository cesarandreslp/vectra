/**
 * Correr con: npx tsx "app/(tenant)/core/estructura/_lib/etapas.test.ts"   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { fechasEtapa } from './etapas'

const t0 = new Date('2026-10-01'), t1 = new Date('2026-10-05')
const nuevo = { etapa: 'CANDIDATO' as const, conversadoEn: null, decididoEn: null }

// Saltar directo a aceptó también marca la conversación.
assert.deepEqual(fechasEtapa(nuevo, 'ACEPTO', t1), { conversadoEn: t1, decididoEn: t1 })
// Conversado → aceptó conserva la fecha de la conversación.
assert.deepEqual(fechasEtapa({ etapa: 'CONVERSADO', conversadoEn: t0, decididoEn: null }, 'ACEPTO', t1), { conversadoEn: t0, decididoEn: t1 })
// Cambiar de decisión fecha la nueva decisión.
assert.deepEqual(fechasEtapa({ etapa: 'NO_ACEPTO', conversadoEn: t0, decididoEn: t0 }, 'ACEPTO', t1), { conversadoEn: t0, decididoEn: t1 })
// Devolver a conversado borra la decisión; a candidato, todo.
assert.deepEqual(fechasEtapa({ etapa: 'ACEPTO', conversadoEn: t0, decididoEn: t0 }, 'CONVERSADO', t1), { conversadoEn: t0, decididoEn: null })
assert.deepEqual(fechasEtapa({ etapa: 'ACEPTO', conversadoEn: t0, decididoEn: t0 }, 'CANDIDATO', t1), { conversadoEn: null, decididoEn: null })

console.log('etapas OK')
