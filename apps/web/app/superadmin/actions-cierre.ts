'use server'

/** Cierre de una campaña: suprimir sus datos personales y desactivarla. Solo SUPERADMIN. */

import { revalidatePath } from 'next/cache'
import { superadminDb, getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { requireAuth } from '@/lib/auth-helpers'
import { registrarEvento } from '@/lib/bitacora'
import { suprimirDatosCampana } from '@/lib/cierre-campana'

export interface EstadoCierre {
  id: string; nombre: string; slug: string; activa: boolean
  fechaEleccion: string | null; electores: number
  copiaPadronEn: string | null; datosSuprimidosEn: string | null
}

export async function getEstadoCierre(tenantId: string): Promise<EstadoCierre | null> {
  await requireAuth(['SUPERADMIN'])
  const t = await superadminDb.tenant.findUnique({ where: { id: tenantId } })
  if (!t) return null
  let fechaEleccion: string | null = null, electores = 0
  if (!t.datosSuprimidosEn) {
    const db = getTenantDb(await getTenantConnection(t.id))
    const [cfg, n] = await Promise.all([
      db.tenantConfig.findUnique({ where: { tenantId: t.id }, select: { fechaEleccion: true } }),
      db.voter.count({ where: { tenantId: t.id } }),
    ])
    fechaEleccion = cfg?.fechaEleccion?.toISOString() ?? null
    electores = n
  }
  return {
    id: t.id, nombre: t.name, slug: t.slug, activa: t.isActive, fechaEleccion, electores,
    copiaPadronEn: t.copiaPadronEn?.toISOString() ?? null, datosSuprimidosEn: t.datosSuprimidosEn?.toISOString() ?? null,
  }
}

/**
 * Irreversible. Exige: la copia del padrón ya generada (para entregarla a la
 * campaña) y escribir el slug exacto. Suprime, desactiva la campaña y todas sus
 * cuentas (sus sesiones se cortan en ≤ 5 min por la revalidación).
 */
export async function cerrarCampana(tenantId: string, slugEscrito: string): Promise<{ success: true; electores: number } | { success: false; error: string }> {
  const session = await requireAuth(['SUPERADMIN'])
  const t = await superadminDb.tenant.findUnique({ where: { id: tenantId } })
  if (!t) return { success: false, error: 'Campaña no encontrada.' }
  if (t.datosSuprimidosEn) return { success: false, error: 'Esta campaña ya fue cerrada.' }
  if (!t.copiaPadronEn) return { success: false, error: 'Primero descarga la copia del padrón para entregársela a la campaña.' }
  if (String(slugEscrito ?? '').trim() !== t.slug) return { success: false, error: `Escribe exactamente "${t.slug}" para confirmar.` }

  const { electores } = await suprimirDatosCampana(getTenantDb(await getTenantConnection(t.id)), t.id)
  await superadminDb.$transaction([
    superadminDb.user.updateMany({ where: { tenantId: t.id }, data: { isActive: false } }),
    superadminDb.tenant.update({ where: { id: t.id }, data: { isActive: false, datosSuprimidosEn: new Date() } }),
  ])
  await registrarEvento({ user: { tenantId: t.id, userId: session.user.userId } }, 'CERRAR_CAMPANA', `${electores} electores suprimidos`)
  revalidatePath('/superadmin/clientes')
  return { success: true, electores }
}
