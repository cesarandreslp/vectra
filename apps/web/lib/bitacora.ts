/**
 * Bitácora desde la app: quién vio o sacó datos personales. Los eventos de
 * login los registra @vectra/auth. Nunca lanza (ver registrarAcceso).
 */

import { headers } from 'next/headers'
import { registrarAcceso } from '@vectra/db'

interface SesionMinima { user: { tenantId: string; userId: string } }

export async function registrarEvento(session: SesionMinima, accion: string, detalle?: string | null, sujeto?: string | null): Promise<void> {
  let ip: string | null = null
  try {
    const h = await headers()
    ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip')
  } catch { /* fuera de una request (scripts): sin IP */ }
  await registrarAcceso({ tenantId: session.user.tenantId, userId: session.user.userId, accion, detalle, sujeto, ip })
}
