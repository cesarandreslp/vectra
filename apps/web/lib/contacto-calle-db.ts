/**
 * Lado servidor de los contactos de calle. Vive fuera de los 'use server'
 * porque recibe la sesión y la DB: exportado desde allá quedaría como
 * endpoint que cualquiera podría llamar con lo que quisiera.
 */

import type { getTenantDb } from '@vectra/db'
import type { requireAuth } from './auth-helpers'
import { hashTelefono } from './contacto-calle'

type Db = ReturnType<typeof getTenantDb>
type SessionVerificada = Awaited<ReturnType<typeof requireAuth>>

export interface CapacidadCalle {
  anfitrionId:     string        // de quién es el contacto: candidato o jefe de debate
  registradoPorId: string | null // quién lo digita
}

/**
 * Quién puede anotar contactos de calle y a nombre de quién quedan. El
 * candidato y los jefes de debate, a nombre propio; quien gestiona una agenda
 * (el asistente) y el staff de la campaña, a nombre del candidato. null = no puede.
 */
export async function capacidadCalle(session: SessionVerificada, db: Db): Promise<CapacidadCalle | null> {
  const tenantId = session.user.tenantId
  const yo = session.user.voterId
    ? await db.voter.findFirst({
        where:  { id: session.user.voterId, tenantId },
        select: { id: true, isCandidate: true, tieneAgenda: true, gestionaAgenda: true },
      })
    : null

  if (yo && (yo.isCandidate || yo.tieneAgenda)) return { anfitrionId: yo.id, registradoPorId: yo.id }
  const esStaff = session.user.role === 'ADMIN_CAMPANA' || session.user.role === 'COORDINADOR'
  if (!esStaff && !yo?.gestionaAgenda) return null

  const candidato = await db.voter.findFirst({ where: { tenantId, isCandidate: true }, select: { id: true } })
  return candidato ? { anfitrionId: candidato.id, registradoPorId: yo?.id ?? null } : null
}

/** Al registrarse un elector con celular, los contactos de calle con ese celular quedan convertidos. */
export async function cerrarContactos(db: Db, tenantId: string, telefono: string | null | undefined, voterId: string) {
  const telefonoHash = hashTelefono(telefono)
  if (!telefonoHash) return
  await db.contactoCalle.updateMany({
    where: { tenantId, telefonoHash, estado: { in: ['PENDIENTE', 'INVITADO'] } },
    data:  { estado: 'CONVERTIDO', voterId },
  })
}
