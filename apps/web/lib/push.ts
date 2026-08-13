import webpush from 'web-push'
import type { getTenantDb } from '@vectra/db'

/** Clave pública VAPID — se sirve al cliente vía Server Action, nunca embebida en el bundle. */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null
}

function configurarVapid(): boolean {
  const publicKey  = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject    = process.env.VAPID_SUBJECT

  if (!publicKey || !privateKey || !subject) return false

  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

/**
 * Envía una notificación push a todos los electores del tenant con
 * suscripción activa. Best-effort: nunca lanza — si Web Push no está
 * configurado (faltan VAPID keys), simplemente no hace nada.
 *
 * Suscripciones que responden 404/410 (expiradas o revocadas por el
 * navegador) se borran para no seguir intentando en cada envío futuro.
 */
export async function enviarPushATenant(
  tenantDb: ReturnType<typeof getTenantDb>,
  tenantId: string,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (!configurarVapid()) return

  const suscripciones = await tenantDb.voterPushSubscription.findMany({ where: { tenantId } })
  if (suscripciones.length === 0) return

  const cuerpo = JSON.stringify(payload)

  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          cuerpo,
        )
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await tenantDb.voterPushSubscription.delete({ where: { id: s.id } }).catch(() => {})
        } else {
          console.error('[PUSH] Error enviando a', s.endpoint, err)
        }
      }
    }),
  )
}
