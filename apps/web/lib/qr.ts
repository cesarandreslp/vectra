import { randomUUID } from 'crypto'
import type { getTenantDb } from '@vectra/db'

/**
 * Crea el QR personal de un elector recién creado — el token que puede
 * compartir para que quien se registre con él quede bajo él en la jerarquía
 * (leaderId = este elector). Se llama automáticamente en cada alta, sin
 * acción del usuario: "líder" es solo la etiqueta que se le da a quien ya
 * juntó suficiente gente, pero cualquier elector puede empezar a captar.
 */
/**
 * El QR con que alguien intenta registrarse, solo si todavía sirve: activo, sin
 * vencer y con su dueño ACTIVO. Inactivar a un elector apaga su enlace — quien
 * lo recibió ya no puede colgarse de él. Los QR de su red siguen funcionando.
 */
export async function qrVigente(
  token:    string,
  tenantId: string,
  db:       ReturnType<typeof getTenantDb>,
): Promise<{ ok: true; id: string; leaderId: string } | { ok: false; error: string }> {
  const qr = await db.qrRegistration.findFirst({
    where:  { token, tenantId, isActive: true },
    select: { id: true, leaderId: true, expiresAt: true },
  })
  if (!qr) return { ok: false, error: 'Este enlace ya no está disponible.' }
  if (qr.expiresAt && qr.expiresAt < new Date()) return { ok: false, error: 'Este enlace ha expirado.' }

  const dueno = await db.voter.findFirst({
    where:  { id: qr.leaderId, tenantId },
    select: { status: true },
  })
  if (dueno?.status !== 'ACTIVO') return { ok: false, error: 'Este enlace ya no está disponible.' }

  return { ok: true, id: qr.id, leaderId: qr.leaderId }
}

export async function crearQrPropio(
  voterId:  string,
  tenantId: string,
  db:       ReturnType<typeof getTenantDb>,
): Promise<string> {
  const qr = await db.qrRegistration.create({
    data: { tenantId, leaderId: voterId, token: randomUUID() },
  })
  return qr.token
}
