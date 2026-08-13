'use server'

/**
 * Hub de tesorería (solo lectura): reúne en un lugar la plata de la campaña, que
 * hoy vive repartida entre presupuestos (CORE) y finanzas (módulo pago). No
 * fusiona nada ni cruza el paywall —cada bloque enlaza a su sitio—; solo compone
 * los números. Requiere FINANZAS activo (sin el módulo no hay hub que armar).
 */

import { requireModuleOrScreen, ModuloInactivoError } from '@/lib/auth-helpers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'

export interface TesoreriaView {
  presupuestos:   { pendientes: number; aprobados: number }
  gastado:        number
  recaudado:      number
  balance:        number
  tope:           number | null
  porcentajeTope: number | null
  informes:       number
  tesorero:       string | null
}

export async function getTesoreria(): Promise<TesoreriaView> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA'], 'CORE_TESORERIA')
  if (!session.user.activeModules.includes('FINANZAS')) throw new ModuloInactivoError('FINANZAS')
  const tenantId = session.user.tenantId
  const db       = getTenantDb(await getTenantConnection(tenantId))

  const [pendientes, aprobados, gastoAgg, donAgg, cfg, informes] = await Promise.all([
    db.actividad.count({ where: { tenantId, presupuestoAprobado: false } }),
    db.actividad.count({ where: { tenantId, presupuestoAprobado: true } }),
    db.expense.aggregate({ where: { tenantId }, _sum: { amount: true } }),
    db.donation.aggregate({ where: { tenantId }, _sum: { amount: true } }),
    db.financeConfig.findUnique({ where: { tenantId }, include: { tesorero: { select: { name: true } } } }),
    db.financeReport.count({ where: { tenantId } }),
  ])

  const gastado   = gastoAgg._sum.amount ?? 0
  const recaudado = donAgg._sum.amount ?? 0

  return {
    presupuestos:   { pendientes, aprobados },
    gastado,
    recaudado,
    balance:        recaudado - gastado,
    tope:           cfg?.topeGastos ?? null,
    porcentajeTope: cfg?.topeGastos ? (gastado / cfg.topeGastos) * 100 : null,
    informes,
    tesorero:       cfg?.tesorero?.name ?? null,
  }
}
