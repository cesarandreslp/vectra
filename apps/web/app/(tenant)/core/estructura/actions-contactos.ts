'use server'

/**
 * Tablero de contactos de calle del candidato: cuántos saluda, cuántos dan
 * datos, cuántos se vuelven electores y cuáles se están quedando sin
 * seguimiento. Sin celulares: conteos y nombres.
 */

import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { contactosCalle, type ContactosCalleView } from '@/lib/estrategia/datos'

export type { ContactosCalleView } from '@/lib/estrategia/datos'

export async function getContactosCalle(): Promise<ContactosCalleView> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_ESTRUCTURA')
  const tenantId = session.user.tenantId
  return contactosCalle(getTenantDb(await getTenantConnection(tenantId)), tenantId)
}
