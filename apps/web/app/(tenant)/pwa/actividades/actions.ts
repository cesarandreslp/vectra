'use server'

/**
 * Actividades desde el PWA del DOLIENTE: el elector que responde por que la
 * actividad ocurra arma sus grupos, asigna simpatizantes y carga la logística.
 *
 * Autorización: no hay rol que valga acá — lo que habilita es ser el doliente
 * de ESA actividad (mismo criterio que el gestor de agenda: el permiso está en
 * el dato, no en el rol). El presupuesto solo lo VE: aprobarlo es de finanzas.
 */

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth-helpers'
import { type UserRole } from '@campaignos/auth'
import { getTenantDb } from '@campaignos/db'
import { getTenantConnection } from '@/lib/tenant'
import { agregarMiembroAGrupo, invalidarPresupuesto } from '@/lib/actividades'

const ROLES_PWA: UserRole[] = ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR']

async function ctx() {
  const session = await requireAuth(ROLES_PWA)
  return {
    voterId:  session.user.voterId,
    tenantId: session.user.tenantId,
    db:       getTenantDb(await getTenantConnection(session.user.tenantId)),
  }
}

/** Verifica que la actividad sea de mi doliencia. Devuelve null si no lo es. */
async function miActividad(db: ReturnType<typeof getTenantDb>, tenantId: string, voterId: string | null, actividadId: string) {
  if (!voterId) return null
  return db.actividad.findFirst({ where: { id: actividadId, tenantId, dolienteId: voterId }, select: { id: true } })
}

/** La actividad dueña de un grupo, solo si soy su doliente. */
async function miActividadDelGrupo(db: ReturnType<typeof getTenantDb>, tenantId: string, voterId: string | null, grupoId: string) {
  if (!voterId) return null
  const g = await db.grupoActividad.findFirst({
    where:  { id: grupoId, tenantId, actividad: { dolienteId: voterId } },
    select: { id: true, actividadId: true },
  })
  return g
}

export interface MiActividad {
  id: string; nombre: string; categoria: string | null; fecha: string | null; estado: string
  presupuestoAprobado: boolean; presupuesto: number
  grupos: {
    id: string; nombre: string; lugar: string | null; inicio: string | null; duracionMin: number | null
    miembros: { id: string; name: string }[]
    insumos: { id: string; descripcion: string; tipo: string; cantidad: number; costoEstimado: number | null; estado: string }[]
  }[]
}

/** Las actividades donde YO soy el doliente. Vacío = esta pantalla no es para mí. */
export async function misActividades(): Promise<MiActividad[]> {
  const { db, tenantId, voterId } = await ctx()
  if (!voterId) return []

  const acts = await db.actividad.findMany({
    where:   { tenantId, dolienteId: voterId },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    include: {
      grupos: {
        orderBy: { createdAt: 'asc' },
        include: { miembros: { include: { voter: { select: { name: true } } } }, insumos: { orderBy: { createdAt: 'asc' } } },
      },
    },
  })

  return acts.map((a) => ({
    id: a.id, nombre: a.nombre, categoria: a.categoria, fecha: a.fecha?.toISOString() ?? null, estado: a.estado,
    presupuestoAprobado: a.presupuestoAprobado,
    presupuesto: a.grupos.reduce((n, g) => n + g.insumos.reduce((m, i) => m + (i.costoEstimado ?? 0) * i.cantidad, 0), 0),
    grupos: a.grupos.map((g) => ({
      id: g.id, nombre: g.nombre, lugar: g.lugar,
      inicio: g.inicio?.toISOString() ?? null, duracionMin: g.duracionMin,
      miembros: g.miembros.map((m) => ({ id: m.id, name: m.voter.name })),
      insumos:  g.insumos.map((i) => ({ id: i.id, descripcion: i.descripcion, tipo: i.tipo, cantidad: i.cantidad, costoEstimado: i.costoEstimado, estado: i.estado })),
    })),
  }))
}

/** Electores del tenant, para elegir a quién sumar a un grupo. */
export async function electoresParaAsignar(): Promise<{ id: string; name: string; esSimpatizante: boolean }[]> {
  const { db, tenantId, voterId } = await ctx()
  if (!voterId) return []
  return db.voter.findMany({ where: { tenantId }, select: { id: true, name: true, esSimpatizante: true }, orderBy: { name: 'asc' } })
}

export async function crearMiGrupo(actividadId: string, data: { nombre: string; lugar?: string; inicio?: string; duracionMin?: number }) {
  const { db, tenantId, voterId } = await ctx()
  if (!(await miActividad(db, tenantId, voterId, actividadId))) return { success: false, error: 'Esa actividad no es tuya.' }
  if (!data.nombre.trim()) return { success: false, error: 'Falta el nombre del grupo.' }
  if (data.duracionMin != null && data.duracionMin <= 0) return { success: false, error: 'La duración tiene que ser mayor que cero.' }

  await db.grupoActividad.create({
    data: {
      tenantId, actividadId, nombre: data.nombre.trim(), lugar: data.lugar?.trim() || undefined,
      inicio: data.inicio ? new Date(data.inicio) : undefined,
      duracionMin: data.duracionMin ?? undefined,
    },
  })
  revalidatePath('/pwa/actividades')
  return { success: true }
}

export async function eliminarMiGrupo(grupoId: string) {
  const { db, tenantId, voterId } = await ctx()
  const g = await miActividadDelGrupo(db, tenantId, voterId, grupoId)
  if (!g) return { success: false, error: 'Ese grupo no es tuyo.' }
  await db.grupoActividad.delete({ where: { id: grupoId } })
  revalidatePath('/pwa/actividades')
  return { success: true }
}

export async function agregarMiMiembro(grupoId: string, electorId: string) {
  const { db, tenantId, voterId } = await ctx()
  if (!(await miActividadDelGrupo(db, tenantId, voterId, grupoId))) return { success: false, error: 'Ese grupo no es tuyo.' }
  const r = await agregarMiembroAGrupo(db, tenantId, grupoId, electorId)
  if (r.success) revalidatePath('/pwa/actividades')
  return r
}

export async function quitarMiMiembro(miembroId: string) {
  const { db, tenantId, voterId } = await ctx()
  if (!voterId) return { success: false, error: 'Sin sesión de elector.' }
  const m = await db.miembroGrupo.findFirst({
    where:  { id: miembroId, tenantId, grupo: { actividad: { dolienteId: voterId } } },
    select: { id: true },
  })
  if (!m) return { success: false, error: 'Ese miembro no es de una actividad tuya.' }
  await db.miembroGrupo.delete({ where: { id: miembroId } })
  revalidatePath('/pwa/actividades')
  return { success: true }
}

export async function agregarMiInsumo(
  grupoId: string,
  data: { descripcion: string; tipo: 'ALIMENTACION' | 'INSUMO' | 'MATERIAL' | 'HERRAMIENTA'; cantidad: number; costoEstimado?: number },
) {
  const { db, tenantId, voterId } = await ctx()
  const g = await miActividadDelGrupo(db, tenantId, voterId, grupoId)
  if (!g) return { success: false, error: 'Ese grupo no es tuyo.' }
  if (!data.descripcion.trim()) return { success: false, error: 'Falta la descripción.' }

  await db.insumoGrupo.create({
    data: {
      tenantId, grupoId, descripcion: data.descripcion.trim(), tipo: data.tipo,
      cantidad: Math.max(1, data.cantidad || 1), costoEstimado: data.costoEstimado,
    },
  })
  // Cambió el monto: si estaba aprobado, vuelve a la bandeja del tesorero.
  await invalidarPresupuesto(db, g.actividadId)
  revalidatePath('/pwa/actividades')
  return { success: true }
}

export async function eliminarMiInsumo(insumoId: string) {
  const { db, tenantId, voterId } = await ctx()
  if (!voterId) return { success: false, error: 'Sin sesión de elector.' }
  const i = await db.insumoGrupo.findFirst({
    where:  { id: insumoId, tenantId, grupo: { actividad: { dolienteId: voterId } } },
    select: { id: true, grupo: { select: { actividadId: true } } },
  })
  if (!i) return { success: false, error: 'Ese insumo no es de una actividad tuya.' }
  await db.insumoGrupo.delete({ where: { id: insumoId } })
  await invalidarPresupuesto(db, i.grupo.actividadId)
  revalidatePath('/pwa/actividades')
  return { success: true }
}
