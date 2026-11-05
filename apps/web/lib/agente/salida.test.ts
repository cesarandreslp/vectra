/**
 * Correr con: npx tsx lib/agente/salida.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { interpretarSalida, normalizarLugar, armarPrompt, presentacion } from './salida'

// Respuesta completa, con texto basura alrededor del JSON (pasa con algunos modelos).
const s = interpretarSalida(`Claro: {"respuesta":"¡Hola! Te cuento.","autorizacion":"ACEPTA","registro":{"nombre":"Ana","barrio":"El Carmen","intereses":["deporte"],"apoyo":"CALIENTE","voluntario":true},"temas":["seguridad","empleo","inventado","seguridad"],"escalar":null} fin`)!
assert.equal(s.respuesta, '¡Hola! Te cuento.')
assert.equal(s.autorizacion, 'ACEPTA')
assert.deepEqual(s.registro, { nombre: 'Ana', barrio: 'El Carmen', intereses: ['deporte'], apoyo: 'CALIENTE', voluntario: true })
assert.deepEqual(s.temas, ['seguridad', 'empleo'])      // fuera de la lista y repetidos: afuera
assert.equal(s.escalar, null)

// Lo que no está en la lista cerrada no pasa.
const raro = interpretarSalida('{"respuesta":"ok","autorizacion":"SI","registro":{"apoyo":"FANATICO","voluntario":"si"},"temas":"seguridad","escalar":{"motivo":"amenaza"}}')!
assert.equal(raro.autorizacion, null)
assert.equal(raro.registro, null)                         // sin nada válido = sin registro
assert.deepEqual(raro.temas, [])
assert.equal(raro.escalar, 'amenaza')

// Sin respuesta o sin JSON: nada (el motor manda el texto de respaldo).
assert.equal(interpretarSalida('no sé'), null)
assert.equal(interpretarSalida('{"respuesta":""}'), null)
assert.equal(interpretarSalida('{"respuesta": "x",'), null)

// Respuesta larga se recorta.
assert.equal(interpretarSalida(JSON.stringify({ respuesta: 'a'.repeat(5000) }))!.respuesta.length, 1000)

assert.equal(normalizarLugar('Barrio  El Cármen '), 'el carmen')
assert.equal(normalizarLugar('VEREDA La Habana'), 'la habana')

// El texto de autorización solo se pide mientras está pendiente.
const ctx = {
  botName: 'Sofi', canal: 'Telegram', candidato: 'Juan Pérez', cargo: null, fechaEleccion: null,
  conocimiento: { propuestas: 'P', biografia: 'B', tono: '', lineamientos: '', textoAutorizacion: 'AUTORIZA-XYZ' },
}
assert.ok(armarPrompt({ ...ctx, autorizacion: 'PENDIENTE' }).includes('AUTORIZA-XYZ'))
assert.ok(!armarPrompt({ ...ctx, autorizacion: 'AUTORIZO' }).includes('AUTORIZA-XYZ'))
assert.ok(presentacion(ctx).includes('inteligencia artificial'))
assert.ok(armarPrompt({ ...ctx, autorizacion: 'AUTORIZO' }).includes('por Telegram'))

console.log('agente/salida OK')
