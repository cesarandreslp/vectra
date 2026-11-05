/**
 * Correr con: npx tsx lib/whatsapp-firma.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { createHmac } from 'crypto'
import { firmaValida } from './whatsapp-firma'

const cuerpo = '{"object":"whatsapp_business_account","entry":[{"id":"1","texto":"¿Qué propone?"}]}'
const firma = 'sha256=' + createHmac('sha256', 'secreto').update(cuerpo).digest('hex')

assert.equal(firmaValida(cuerpo, firma, 'secreto'), true)
assert.equal(firmaValida(cuerpo, firma, 'otro-secreto'), false)            // secreto de otra app
assert.equal(firmaValida(cuerpo + ' ', firma, 'secreto'), false)          // cuerpo alterado
assert.equal(firmaValida(cuerpo, firma.replace('sha256=', ''), 'secreto'), false)
assert.equal(firmaValida(cuerpo, 'sha256=abc', 'secreto'), false)         // largo distinto: no revienta
assert.equal(firmaValida(cuerpo, null, 'secreto'), false)

console.log('whatsapp-firma OK')
