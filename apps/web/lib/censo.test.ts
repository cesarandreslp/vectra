/**
 * Chequeo de la firma del webhook del censo y de la lectura de jobs.
 *
 * La firma es lo único que impide que un tercero escriba lugares de votación
 * falsos en el padrón; por eso se prueban los rechazos, no solo el caso bueno.
 *
 * Correr con: npx tsx lib/censo.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { createHmac } from 'crypto'
import { firmaValida, interpretarJob } from './censo'

const secreto = 'whsec_prueba'
const cuerpo  = '{"job_id":"abc","status":"done"}'
const ahora   = 1_800_000_000
const firmar  = (ts: string, body: string) =>
  'sha256=' + createHmac('sha256', secreto).update(`${ts}.${body}`).digest('hex')

const ts = String(ahora)
assert.equal(firmaValida(secreto, ts, cuerpo, firmar(ts, cuerpo), ahora), true, 'firma correcta')
assert.equal(firmaValida(secreto, ts, cuerpo + ' ', firmar(ts, cuerpo), ahora), false, 'cuerpo alterado')
assert.equal(firmaValida('otro', ts, cuerpo, firmar(ts, cuerpo), ahora), false, 'otro secreto')
assert.equal(firmaValida(secreto, ts, cuerpo, firmar(ts, cuerpo).slice(0, -1), ahora), false, 'firma truncada')
const viejo = String(ahora - 301)
assert.equal(firmaValida(secreto, viejo, cuerpo, firmar(viejo, cuerpo), ahora), false, 'timestamp de hace más de 300 s')
assert.equal(firmaValida(secreto, '', cuerpo, firmar('', cuerpo), ahora), false, 'sin timestamp')

// Las formas documentadas por la API
assert.equal(interpretarJob({ job_id: 'a', status: 'pending' }), null, 'en cola')
assert.equal(interpretarJob({ job_id: 'a', status: 'processing' }), null, 'en curso')
assert.deepEqual(interpretarJob({ job_id: 'a', status: 'failed', success: false, error: 'no disponible' }), { estado: 'ERROR', lugar: null })
assert.deepEqual(interpretarJob({ success: false, error: 'job no encontrado.' }), { estado: 'ERROR', lugar: null }, '404')

const webhook = interpretarJob({
  job_id: 'abc-123', tipo: 'registraduria', status: 'done', success: true,
  data: { estado: 'encontrado', nuip: '1020304050', puesto: 'COLEGIO NACIONAL NICOLÁS ESGUERRA', mesa: '14' },
})
assert.equal(webhook?.estado, 'ENCONTRADO')
assert.equal(webhook?.lugar?.mesa, '14')
assert.equal(webhook?.lugar?.nuip, undefined, 'la cédula en claro no se guarda')

const idempotente = interpretarJob({ success: true, data: { estado: 'no_encontrado', mensaje: 'No figura' } })
assert.equal(idempotente?.estado, 'NO_ENCONTRADO', '200 del POST sin status')

console.log('censo: ok')
