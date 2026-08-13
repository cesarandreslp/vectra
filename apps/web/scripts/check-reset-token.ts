#!/usr/bin/env tsx
/**
 * Check del token de restablecimiento: vale una vez, vence, y no se puede falsificar.
 * Correr desde apps/web:  tsx scripts/check-reset-token.ts
 */
import assert from 'assert'
import { crearResetToken, leerResetToken, userIdDelToken } from '../lib/reset-token'

process.env.NEXTAUTH_SECRET ??= 'secreto-de-prueba'

const USER = 'usr_123'
const HASH = '$2a$12$hashviejo'
const hash = () => HASH

const token = crearResetToken(USER, HASH)
assert.equal(leerResetToken(token, hash), USER, 'el token recién creado debe validar')
assert.equal(userIdDelToken(token), USER, 'se puede leer el userId sin validar')

// un solo uso: al cambiar la contraseña, el hash cambia y la firma deja de cuadrar
assert.equal(leerResetToken(token, () => '$2a$12$hashnuevo'), null, 'el token no debe servir dos veces')

// cambiarle el userId al payload invalida la firma (no se puede apuntar a otra cuenta)
const suplantado = (() => {
  const [payloadB64, firma] = token.split('.')
  const payload = Buffer.from(payloadB64!, 'base64url').toString().replace(USER, 'otro')
  return `${Buffer.from(payload).toString('base64url')}.${firma}`
})()
assert.equal(leerResetToken(suplantado, hash), null, 'no se puede reapuntar el token a otra cuenta')

// usuario inexistente (sin hash) no valida
assert.equal(leerResetToken(token, () => null), null, 'sin usuario no hay validación')

// firma alterada
assert.equal(leerResetToken(token.slice(0, -2) + 'xx', hash), null, 'firma alterada debe fallar')
assert.equal(leerResetToken(token.split('.')[0]!, hash), null, 'token sin firma debe fallar')

// vencido: payload con expiración pasada, firmado de verdad
const vencido = (() => {
  const { createHmac } = require('crypto') as typeof import('crypto')
  const payload = `${USER}.${Date.now() - 1000}`
  const firma = createHmac('sha256', process.env.NEXTAUTH_SECRET!).update(`${payload}.${HASH}`).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${firma}`
})()
assert.equal(leerResetToken(vencido, hash), null, 'el token vencido debe fallar')

console.log('✔ token de restablecimiento: un solo uso, vence, no falsificable')
