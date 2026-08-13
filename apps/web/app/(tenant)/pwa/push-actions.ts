'use server'

import { requireAuth } from '@/lib/auth-helpers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { getVapidPublicKey } from '@/lib/push'

/**
 * Estado de elegibilidad para notificaciones push: clave pública VAPID (no
 * es secreta, pero se sirve por Server Action en vez de NEXT_PUBLIC_ para no
 * bundlear env vars) + si tiene sentido ofrecerlas (elector enlazado a un
 * Voter y módulo ENCUESTAS activo, que es lo único que hoy dispara push).
 */
export async function getEstadoPush(): Promise<{ publicKey: string | null; elegible: boolean }> {
  const session = await requireAuth(['ELECTOR', 'LIDER', 'ADMIN_CAMPANA', 'COORDINADOR', 'TESTIGO'])
  const elegible = Boolean(session.user.voterId) && session.user.activeModules.includes('ENCUESTAS')
  return { publicKey: getVapidPublicKey(), elegible }
}

interface SuscripcionPush {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** Guarda la suscripción push del elector logueado (requiere Voter enlazado). */
export async function suscribirPush(sub: SuscripcionPush) {
  const session = await requireAuth(['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR'])
  if (!session.user.voterId) {
    return { success: false, error: 'Esta cuenta no tiene un elector enlazado.' }
  }

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  await db.voterPushSubscription.upsert({
    where:  { endpoint: sub.endpoint },
    create: {
      tenantId: session.user.tenantId,
      voterId:  session.user.voterId,
      endpoint: sub.endpoint,
      p256dh:   sub.keys.p256dh,
      auth:     sub.keys.auth,
    },
    update: {
      voterId: session.user.voterId,
      p256dh:  sub.keys.p256dh,
      auth:    sub.keys.auth,
    },
  })

  return { success: true }
}

/** Borra la suscripción push (el elector desactivó las notificaciones). */
export async function desuscribirPush(endpoint: string) {
  const session = await requireAuth(['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR'])
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  await db.voterPushSubscription.deleteMany({
    where: { endpoint, tenantId: session.user.tenantId },
  })

  return { success: true }
}
