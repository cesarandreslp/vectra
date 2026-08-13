/**
 * Tokens de restablecimiento de contraseña, firmados — sin tabla en DB.
 *
 * El token es `base64url(userId.expira).firma`, donde la firma es un HMAC que
 * incluye el passwordHash actual del usuario. Consecuencias:
 *   - se invalida solo al usarse (cambia el passwordHash → la firma ya no cuadra)
 *   - se invalida si el usuario cambia la contraseña por otra vía
 *   - no hay tokens viejos que limpiar
 */

import { createHmac, timingSafeEqual } from 'crypto'

const VIGENCIA_MS = 60 * 60 * 1000 // 1 hora

function firmar(payload: string, passwordHash: string): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('Falta NEXTAUTH_SECRET para firmar el token de restablecimiento')
  return createHmac('sha256', secret).update(`${payload}.${passwordHash}`).digest('base64url')
}

export function crearResetToken(userId: string, passwordHash: string): string {
  const payload = `${userId}.${Date.now() + VIGENCIA_MS}`
  return `${Buffer.from(payload).toString('base64url')}.${firmar(payload, passwordHash)}`
}

/** Devuelve el userId si el token es válido para ese usuario, o null. */
export function leerResetToken(token: string, buscarPasswordHash: (userId: string) => string | null): string | null {
  const [payloadB64, firma] = token.split('.')
  if (!payloadB64 || !firma) return null

  const payload = Buffer.from(payloadB64, 'base64url').toString()
  const [userId, expira] = payload.split('.')
  if (!userId || !expira) return null
  if (Number(expira) < Date.now()) return null

  const passwordHash = buscarPasswordHash(userId)
  if (!passwordHash) return null

  const esperada = Buffer.from(firmar(payload, passwordHash))
  const recibida = Buffer.from(firma)
  if (esperada.length !== recibida.length) return null
  return timingSafeEqual(esperada, recibida) ? userId : null
}

/** Solo para el userId, sin validar — para buscar al usuario antes de verificar la firma. */
export function userIdDelToken(token: string): string | null {
  const payloadB64 = token.split('.')[0]
  if (!payloadB64) return null
  return Buffer.from(payloadB64, 'base64url').toString().split('.')[0] || null
}
