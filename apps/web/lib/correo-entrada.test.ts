/**
 * Correr con: npx tsx lib/correo-entrada.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { autorizado, leerCorreo, asuntoRespuesta, claveCorreo, textoAHtml, USUARIO_WEBHOOK } from './correo-entrada'
import { claveTelegram } from './telegram'

const basic = (u: string, k: string) => `Basic ${Buffer.from(`${u}:${k}`).toString('base64')}`
assert.equal(autorizado(basic(USUARIO_WEBHOOK, 's3creto'), 's3creto'), true)
assert.equal(autorizado(basic(USUARIO_WEBHOOK, 'otro'), 's3creto'), false)
assert.equal(autorizado(basic('alguien', 's3creto'), 's3creto'), false)
assert.equal(autorizado(null, 's3creto'), false)
assert.equal(autorizado('Bearer s3creto', 's3creto'), false)

const base = {
  FromFull: { Email: 'Ana.Ruiz@Gmail.com', Name: 'Ana Ruiz' }, Subject: 'RE: Re: ¿Qué propone?', MessageID: 'abc',
  TextBody: 'Me interesa la seguridad.\n\nEl lun, Campaña escribió:\n> hola', StrippedTextReply: 'Me interesa la seguridad.',
  Headers: [],
}
const c = leerCorreo(base, ['campana@iguaran.co'])!
assert.equal(c.de, 'ana.ruiz@gmail.com')
assert.equal(c.texto, 'Me interesa la seguridad.') // sin el hilo citado
assert.equal(c.nombre, 'Ana Ruiz')
assert.equal(asuntoRespuesta(c.asunto), 'Re: ¿Qué propone?')
assert.equal(asuntoRespuesta(''), 'Re: Tu mensaje a la campaña')

// Lo que no se contesta.
assert.equal(leerCorreo({ ...base, FromFull: { Email: 'Campana@Iguaran.co' } }, ['campana@iguaran.co']), null) // la propia campaña: bucle
assert.equal(leerCorreo({ ...base, FromFull: { Email: 'no-reply@banco.com' } }, []), null)
assert.equal(leerCorreo({ ...base, Headers: [{ Name: 'Auto-Submitted', Value: 'auto-replied' }] }, []), null) // "estoy de vacaciones"
assert.equal(leerCorreo({ ...base, Headers: [{ Name: 'Auto-Submitted', Value: 'no' }] }, [])?.de, 'ana.ruiz@gmail.com')
assert.equal(leerCorreo({ ...base, StrippedTextReply: '', TextBody: '   ' }, []), null)
assert.equal(leerCorreo({ ...base, FromFull: undefined, From: 'no es correo' }, []), null)
// Sin StrippedTextReply (primer correo, no respuesta): el cuerpo entero.
assert.equal(leerCorreo({ ...base, StrippedTextReply: undefined, TextBody: 'Hola' }, [])?.texto, 'Hola')

// Las claves de identidad de cada canal no se cruzan.
assert.equal(claveCorreo(' ANA@x.co'), claveCorreo('ana@x.co'))
assert.notEqual(claveCorreo('42'), claveTelegram('42'))

assert.ok(textoAHtml('Hola <b>x</b>\nchao').includes('Hola &lt;b&gt;x&lt;/b&gt;<br>chao'))

console.log('correo-entrada OK')
