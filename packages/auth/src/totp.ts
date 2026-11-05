/**
 * TOTP (RFC 6238): el código de 6 dígitos que cambia cada 30 s en Google
 * Authenticator, Microsoft Authenticator, Authy… Con el crypto de Node, sin
 * dependencias. HMAC-SHA1, que es lo que esas apps usan por defecto.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567' // base32 (RFC 4648)
const PASO_S = 30

export function base32(buf: Buffer): string {
  let bits = 0, valor = 0, out = ''
  for (const b of buf) {
    valor = (valor << 8) | b; bits += 8
    while (bits >= 5) { out += ALFABETO[(valor >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += ALFABETO[(valor << (5 - bits)) & 31]
  return out
}

export function desdeBase32(s: string): Buffer {
  const limpio = s.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0, valor = 0
  const out: number[] = []
  for (const c of limpio) {
    valor = (valor << 5) | ALFABETO.indexOf(c); bits += 5
    if (bits >= 8) { out.push((valor >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}

/** Secreto nuevo de 160 bits, en base32 (lo que se escanea con el QR). */
export function nuevoSecreto(): string {
  return base32(randomBytes(20))
}

export function codigoTotp(secreto: string, instante = Date.now()): string {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(Math.floor(instante / 1000 / PASO_S)))
  const h = createHmac('sha1', desdeBase32(secreto)).update(contador).digest()
  const o = h[h.length - 1] & 15
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 1_000_000).padStart(6, '0')
}

/** Acepta el código actual y el de 30 s antes o después (relojes de celular desfasados). */
export function verificarTotp(secreto: string, codigo: string, instante = Date.now()): boolean {
  const c = codigo.replace(/\s/g, '')
  if (!/^\d{6}$/.test(c)) return false
  return [-1, 0, 1].some((d) => {
    const esperado = Buffer.from(codigoTotp(secreto, instante + d * PASO_S * 1000))
    return timingSafeEqual(esperado, Buffer.from(c))
  })
}

/** El enlace que leen las apps de autenticación (va dentro del QR). */
export function uriTotp(secreto: string, cuenta: string, emisor = 'Vectra'): string {
  const e = encodeURIComponent(emisor)
  return `otpauth://totp/${e}:${encodeURIComponent(cuenta)}?secret=${secreto}&issuer=${e}&algorithm=SHA1&digits=6&period=${PASO_S}`
}
