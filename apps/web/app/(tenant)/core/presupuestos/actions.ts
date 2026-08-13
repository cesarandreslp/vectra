'use server'

/**
 * Aprobación de presupuestos por el área financiera (tesorero).
 *
 * Regla: una actividad no se ejecuta si su presupuesto no está aprobado. La
 * aprobación es sobre un monto concreto; si después cambian los insumos, se
 * cae (ver invalidarPresupuesto, que llaman las actions de Actividades).
 */

import { revalidatePath } from 'next/cache'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'

const SCREEN = 'CORE_PRESUPUESTOS'

async function db(edit = false) {
  // Roles fijos: solo el ADMIN_CAMPANA. El tesorero entra como rol PERSONALIZADO
  // con permiso sobre esta pantalla — así el permiso se otorga sin tocar código.
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA'], SCREEN, edit ? 'edit' : 'view')
  return { session, db: getTenantDb(await getTenantConnection(session.user.tenantId)), tenantId: session.user.tenantId }
}

export interface PresupuestoActividad {
  id: string; nombre: string; categoria: string | null; fecha: string | null; estado: string
  doliente: string; aprobado: boolean; aprobadoPor: string | null; aprobadoEn: string | null
  total: number
  grupos: { nombre: string; lugar: string | null; insumos: { descripcion: string; tipo: string; cantidad: number; costoEstimado: number | null }[] }[]
}

/** @param soloPendientes true = las que esperan aprobación; false = las ya aprobadas. */
export async function getPresupuestos(soloPendientes: boolean): Promise<PresupuestoActividad[]> {
  const { db: d, tenantId } = await db()
  const acts = await d.actividad.findMany({
    where:   { tenantId, presupuestoAprobado: !soloPendientes },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    include: {
      doliente: { select: { name: true } },
      grupos:   { orderBy: { createdAt: 'asc' }, include: { insumos: { orderBy: { createdAt: 'asc' } } } },
    },
  })

  return acts.map((a) => ({
    id: a.id, nombre: a.nombre, categoria: a.categoria, fecha: a.fecha?.toISOString() ?? null, estado: a.estado,
    doliente: a.doliente.name,
    aprobado: a.presupuestoAprobado,
    aprobadoPor: a.presupuestoAprobadoPor,
    aprobadoEn: a.presupuestoAprobadoEn?.toISOString() ?? null,
    total: a.grupos.reduce((n, g) => n + g.insumos.reduce((m, i) => m + (i.costoEstimado ?? 0) * i.cantidad, 0), 0),
    grupos: a.grupos.map((g) => ({
      nombre: g.nombre, lugar: g.lugar,
      insumos: g.insumos.map((i) => ({ descripcion: i.descripcion, tipo: i.tipo, cantidad: i.cantidad, costoEstimado: i.costoEstimado })),
    })),
  }))
}

export async function aprobarPresupuesto(actividadId: string) {
  const { db: d, tenantId, session } = await db(true)
  const a = await d.actividad.findFirst({
    where: { id: actividadId, tenantId },
    select: { id: true, presupuestoAprobado: true, grupos: { select: { _count: { select: { insumos: true } } } } },
  })
  if (!a) return { success: false, error: 'Actividad no encontrada.' }
  if (a.presupuestoAprobado) return { success: false, error: 'Ese presupuesto ya estaba aprobado.' }
  if (a.grupos.reduce((n, g) => n + g._count.insumos, 0) === 0) {
    return { success: false, error: 'La actividad todavía no tiene insumos: no hay presupuesto que aprobar.' }
  }

  await d.actividad.update({
    where: { id: actividadId },
    data:  { presupuestoAprobado: true, presupuestoAprobadoPor: session.user.email ?? 'desconocido', presupuestoAprobadoEn: new Date() },
  })
  revalidatePath('/core/presupuestos')
  revalidatePath('/core/actividades')
  return { success: true }
}

/** Deshacer una aprobación (p. ej. si el monto se aprobó por error). */
export async function revocarPresupuesto(actividadId: string) {
  const { db: d, tenantId } = await db(true)
  const a = await d.actividad.findFirst({ where: { id: actividadId, tenantId }, select: { id: true, estado: true } })
  if (!a) return { success: false, error: 'Actividad no encontrada.' }
  if (a.estado !== 'PLANEADA') return { success: false, error: 'La actividad ya arrancó: no se puede revocar el presupuesto.' }

  await d.actividad.update({
    where: { id: actividadId },
    data:  { presupuestoAprobado: false, presupuestoAprobadoPor: null, presupuestoAprobadoEn: null },
  })
  revalidatePath('/core/presupuestos')
  revalidatePath('/core/actividades')
  return { success: true }
}
