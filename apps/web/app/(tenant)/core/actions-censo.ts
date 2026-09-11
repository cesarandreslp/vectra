'use server'

import { revalidatePath } from 'next/cache'
import { getTenantDb } from '@vectra/db'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { censoConfigurado, encolarCenso, procesarCensoPendientes, recogerCenso } from '@/lib/censo'

const NO_CONFIGURADA = 'La API del censo no está configurada (CENSO_API_URL / CENSO_API_KEY).'

async function dbConPermiso() {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_ELECTORES', 'edit')
  const tenantId = session.user.tenantId
  return { tenantId, db: getTenantDb(await getTenantConnection(tenantId)) }
}

/** Ficha del elector: si hay una consulta en curso la recoge; si no, encola una nueva. */
export async function verificarCensoElector(voterId: string): Promise<{ success: boolean; error?: string }> {
  const { db, tenantId } = await dbConPermiso()
  if (!censoConfigurado()) return { success: false, error: NO_CONFIGURADA }

  const v = await db.voter.findFirst({
    where:  { id: voterId, tenantId },
    select: { id: true, cedula: true, censoEstado: true, censoJobId: true },
  })
  if (!v) return { success: false, error: 'Elector no encontrado.' }

  if (v.censoEstado === 'PENDIENTE' && v.censoJobId) await recogerCenso(db, tenantId, v.censoJobId)
  else await encolarCenso(db, tenantId, v)

  revalidatePath(`/core/electores/${voterId}`)
  return { success: true }
}

/** Listado: un lote de hasta 200 sobre el padrón. Se repite hasta que no queden. */
export async function verificarPadronCenso(): Promise<
  { success: true; encolados: number; revisados: number; restantes: number } | { success: false; error: string }
> {
  const { db, tenantId } = await dbConPermiso()
  if (!censoConfigurado()) return { success: false, error: NO_CONFIGURADA }

  const r = await procesarCensoPendientes(db, tenantId, 200)
  revalidatePath('/core/electores')
  return { success: true, ...r }
}
