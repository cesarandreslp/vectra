/**
 * Bitácora de accesos (RegistroAcceso, en la BD del superadmin) y bloqueo de
 * fuerza bruta en el login. Registrar nunca lanza: una bitácora caída no puede
 * tumbar un login ni una pantalla.
 */

import { createHash } from 'crypto'
import { superadminDb } from './index'

export interface EventoAcceso {
  tenantId?: string | null; userId?: string | null; accion: string
  detalle?: string | null; sujeto?: string | null; claveHash?: string | null; ip?: string | null
}

export async function registrarAcceso(e: EventoAcceso): Promise<void> {
  try {
    await superadminDb.registroAcceso.create({
      data: {
        tenantId: e.tenantId ?? null, userId: e.userId ?? null, accion: e.accion,
        detalle: e.detalle?.slice(0, 300) ?? null, sujeto: e.sujeto?.slice(0, 200) ?? null,
        claveHash: e.claveHash ?? null, ip: e.ip?.slice(0, 64) ?? null,
      },
    })
  } catch (err) {
    console.error('[BITACORA] No se pudo registrar:', err instanceof Error ? err.message : err)
  }
}

export function hashClave(s: string): string {
  return createHash('sha256').update(s.trim().toLowerCase()).digest('hex')
}

/** "1234567890" → "···7890": la bitácora identifica sin exponer la cédula. */
export function enmascarar(s: string): string {
  const d = s.replace(/\s/g, '')
  return d.length > 4 ? `···${d.slice(-4)}` : '···'
}

const VENTANA_MS = 15 * 60_000
export const MAX_FALLOS_CUENTA = 5  // misma cuenta (correo o cédula)
export const MAX_FALLOS_IP     = 30 // misma IP, cualquier cuenta: robo de claves en masa

/** ¿Bloqueado? 5 fallos de la misma cuenta, o 30 desde la misma IP, en 15 min. */
export async function loginBloqueado(claveHash: string, ip: string | null): Promise<boolean> {
  try {
    const desde = new Date(Date.now() - VENTANA_MS)
    const [cuenta, porIp] = await Promise.all([
      superadminDb.registroAcceso.count({ where: { claveHash, accion: 'LOGIN_FALLIDO', fecha: { gte: desde } } }),
      ip ? superadminDb.registroAcceso.count({ where: { ip, accion: 'LOGIN_FALLIDO', fecha: { gte: desde } } }) : 0,
    ])
    return cuenta >= MAX_FALLOS_CUENTA || porIp >= MAX_FALLOS_IP
  } catch {
    return false // si la bitácora no responde, no se deja a todos afuera
  }
}
