import { randomUUID } from 'crypto'
import type { getTenantDb } from '@vectra/db'

/**
 * Crea el QR personal de un elector recién creado — el token que puede
 * compartir para que quien se registre con él quede bajo él en la jerarquía
 * (leaderId = este elector). Se llama automáticamente en cada alta, sin
 * acción del usuario: "líder" es solo la etiqueta que se le da a quien ya
 * juntó suficiente gente, pero cualquier elector puede empezar a captar.
 */
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
