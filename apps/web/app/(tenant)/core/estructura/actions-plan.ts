'use server'

/**
 * Plan contra realidad: lo que la meta de votos exige en cada nivel de la red
 * frente a lo que hay en el árbol Voter. La consulta vive en lib/estrategia/datos
 * para que el agente semanal la use sin sesión.
 */

import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { planEstructura, type PlanView } from '@/lib/estrategia/datos'

export type { LiderPlan, PlanView } from '@/lib/estrategia/datos'

export async function getPlanEstructura(): Promise<PlanView> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_ESTRUCTURA')
  const tenantId = session.user.tenantId
  return planEstructura(getTenantDb(await getTenantConnection(tenantId)), tenantId)
}
