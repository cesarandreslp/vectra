'use server'

import { revalidatePath } from 'next/cache'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { agregarMiembroAGrupo, invalidarPresupuesto } from '@/lib/actividades'

const ROLES_ADMIN = ['ADMIN_CAMPANA', 'COORDINADOR'] as const
const SCREEN = 'CORE_ACTIVIDADES'

type InsumoTipo = 'ALIMENTACION' | 'INSUMO' | 'MATERIAL' | 'HERRAMIENTA'
type InsumoEstado = 'REQUERIDO' | 'APROBADO' | 'CONSEGUIDO'

async function db(edit = false) {
  const session = await requireModuleOrScreen('CORE', [...ROLES_ADMIN], SCREEN, edit ? 'edit' : 'view')
  return { session, db: getTenantDb(await getTenantConnection(session.user.tenantId)), tenantId: session.user.tenantId }
}

// ── Actividades ────────────────────────────────────────────────────────────────

export interface ActividadResumen {
  id: string; nombre: string; categoria: string | null; fecha: string | null; estado: string
  doliente: string; presupuestoAprobado: boolean; presupuesto: number
  grupos: number; simpatizantes: number; insumos: number
}

export async function getActividades(): Promise<ActividadResumen[]> {
  const { db: d, tenantId } = await db()
  const acts = await d.actividad.findMany({
    where:   { tenantId },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    include: {
      doliente: { select: { name: true } },
      grupos:   {
        select: {
          _count:  { select: { miembros: true, insumos: true } },
          insumos: { select: { cantidad: true, costoEstimado: true } },
        },
      },
    },
  })
  return acts.map((a) => ({
    id: a.id, nombre: a.nombre, categoria: a.categoria, fecha: a.fecha?.toISOString() ?? null, estado: a.estado,
    doliente: a.doliente.name,
    presupuestoAprobado: a.presupuestoAprobado,
    presupuesto: a.grupos.reduce((n, g) => n + g.insumos.reduce((m, i) => m + (i.costoEstimado ?? 0) * i.cantidad, 0), 0),
    grupos: a.grupos.length,
    simpatizantes: a.grupos.reduce((n, g) => n + g._count.miembros, 0),
    insumos: a.grupos.reduce((n, g) => n + g._count.insumos, 0),
  }))
}

export async function crearActividad(data: { nombre: string; categoria?: string; fecha?: string; dolienteId: string }) {
  const { db: d, tenantId } = await db(true)
  if (!data.nombre.trim()) return { success: false, error: 'Falta el nombre.' }
  if (!data.dolienteId)    return { success: false, error: 'Toda actividad necesita un doliente.' }

  const doliente = await d.voter.findFirst({ where: { id: data.dolienteId, tenantId }, select: { id: true } })
  if (!doliente) return { success: false, error: 'El doliente no es válido.' }

  await d.actividad.create({
    data: {
      tenantId, nombre: data.nombre.trim(), dolienteId: doliente.id,
      categoria: data.categoria?.trim() || undefined,
      // Mediodía UTC: new Date('2026-08-22') es medianoche UTC y en Colombia
      // (-5) se muestra como el 21. Con las 12:00 el día no se corre en ninguna zona.
      fecha: data.fecha ? new Date(`${data.fecha}T12:00:00Z`) : undefined,
    },
  })
  revalidatePath('/core/actividades')
  return { success: true }
}

export async function eliminarActividad(id: string) {
  const { db: d, tenantId } = await db(true)
  const a = await d.actividad.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!a) return { success: false, error: 'Actividad no encontrada.' }
  await d.actividad.delete({ where: { id } }) // borra grupos/miembros/insumos en cascada
  revalidatePath('/core/actividades')
  return { success: true }
}

/**
 * Cambia el estado de la actividad. Arrancar (o dar por realizada) exige que el
 * área financiera haya aprobado el presupuesto — ver /core/presupuestos.
 */
export async function cambiarEstadoActividad(id: string, estado: 'PLANEADA' | 'EN_CURSO' | 'REALIZADA' | 'CANCELADA') {
  const { db: d, tenantId } = await db(true)
  const a = await d.actividad.findFirst({ where: { id, tenantId }, select: { id: true, presupuestoAprobado: true } })
  if (!a) return { success: false, error: 'Actividad no encontrada.' }

  if ((estado === 'EN_CURSO' || estado === 'REALIZADA') && !a.presupuestoAprobado) {
    return { success: false, error: 'El presupuesto todavía no está aprobado por el área financiera: la actividad no se puede ejecutar.' }
  }

  await d.actividad.update({ where: { id }, data: { estado } })
  revalidatePath('/core/actividades')
  return { success: true }
}

// ── Detalle: grupos, miembros, insumos ─────────────────────────────────────────

export interface GrupoDetalle {
  id: string; nombre: string; lugar: string | null; responsableName: string | null
  inicio: string | null; duracionMin: number | null
  miembros: { id: string; voterId: string; name: string }[]
  insumos:  { id: string; descripcion: string; tipo: string; cantidad: number; costoEstimado: number | null; estado: string }[]
}
export interface ActividadDetalle {
  id: string; nombre: string; categoria: string | null; fecha: string | null; estado: string
  doliente: string; presupuestoAprobado: boolean; descripcion: string | null; grupos: GrupoDetalle[]
}

export async function getActividadDetalle(id: string): Promise<ActividadDetalle | null> {
  const { db: d, tenantId } = await db()
  const a = await d.actividad.findFirst({
    where:   { id, tenantId },
    include: {
      doliente: { select: { name: true } },
      grupos: {
        orderBy: { createdAt: 'asc' },
        include: {
          responsable: { select: { name: true } },
          miembros:    { include: { voter: { select: { name: true } } } },
          insumos:     { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  if (!a) return null
  return {
    id: a.id, nombre: a.nombre, categoria: a.categoria, fecha: a.fecha?.toISOString() ?? null, estado: a.estado,
    doliente: a.doliente.name, presupuestoAprobado: a.presupuestoAprobado, descripcion: a.descripcion,
    grupos: a.grupos.map((g) => ({
      id: g.id, nombre: g.nombre, lugar: g.lugar, responsableName: g.responsable?.name ?? null,
      inicio: g.inicio?.toISOString() ?? null, duracionMin: g.duracionMin,
      miembros: g.miembros.map((m) => ({ id: m.id, voterId: m.voterId, name: m.voter.name })),
      insumos:  g.insumos.map((i) => ({ id: i.id, descripcion: i.descripcion, tipo: i.tipo, cantidad: i.cantidad, costoEstimado: i.costoEstimado, estado: i.estado })),
    })),
  }
}

export async function crearGrupo(
  actividadId: string,
  data: { nombre: string; lugar?: string; responsableId?: string; inicio?: string; duracionMin?: number },
) {
  const { db: d, tenantId } = await db(true)
  const act = await d.actividad.findFirst({ where: { id: actividadId, tenantId }, select: { id: true } })
  if (!act) return { success: false, error: 'Actividad no encontrada.' }
  if (!data.nombre.trim()) return { success: false, error: 'Falta el nombre del grupo.' }
  if (data.duracionMin != null && data.duracionMin <= 0) return { success: false, error: 'La duración tiene que ser mayor que cero.' }

  await d.grupoActividad.create({
    data: {
      tenantId, actividadId, nombre: data.nombre.trim(),
      lugar: data.lugar?.trim() || undefined, responsableId: data.responsableId || undefined,
      // datetime-local llega sin zona; el server lo interpreta en su hora local.
      inicio: data.inicio ? new Date(data.inicio) : undefined,
      duracionMin: data.duracionMin ?? undefined,
    },
  })
  revalidatePath('/core/actividades')
  return { success: true }
}

export async function eliminarGrupo(id: string) {
  const { db: d, tenantId } = await db(true)
  const g = await d.grupoActividad.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!g) return { success: false, error: 'Grupo no encontrado.' }
  await d.grupoActividad.delete({ where: { id } })
  revalidatePath('/core/actividades')
  return { success: true }
}

// ── Miembros (asignar simpatizante a un grupo) ─────────────────────────────────

/** Agrega un elector a un grupo. La regla (cruce de horarios + marca de
 * simpatizante) vive en lib/actividades para que el PWA del doliente la aplique igual. */
export async function agregarMiembro(grupoId: string, voterId: string) {
  const { db: d, tenantId } = await db(true)
  const r = await agregarMiembroAGrupo(d, tenantId, grupoId, voterId)
  if (r.success) revalidatePath('/core/actividades')
  return r
}

export async function quitarMiembro(miembroId: string) {
  const { db: d, tenantId } = await db(true)
  const m = await d.miembroGrupo.findFirst({ where: { id: miembroId, tenantId }, select: { id: true } })
  if (!m) return { success: false, error: 'Miembro no encontrado.' }
  await d.miembroGrupo.delete({ where: { id: miembroId } })
  revalidatePath('/core/actividades')
  return { success: true }
}

// ── Insumos (logística por grupo) ──────────────────────────────────────────────

export async function agregarInsumo(grupoId: string, data: { descripcion: string; tipo: InsumoTipo; cantidad: number; costoEstimado?: number }) {
  const { db: d, tenantId } = await db(true)
  const g = await d.grupoActividad.findFirst({ where: { id: grupoId, tenantId }, select: { id: true, actividadId: true } })
  if (!g) return { success: false, error: 'Grupo no encontrado.' }
  if (!data.descripcion.trim()) return { success: false, error: 'Falta la descripción.' }
  await d.insumoGrupo.create({
    data: { tenantId, grupoId, descripcion: data.descripcion.trim(), tipo: data.tipo, cantidad: Math.max(1, data.cantidad || 1), costoEstimado: data.costoEstimado },
  })
  await invalidarPresupuesto(d, g.actividadId)
  revalidatePath('/core/actividades')
  return { success: true }
}

export async function eliminarInsumo(id: string) {
  const { db: d, tenantId } = await db(true)
  const i = await d.insumoGrupo.findFirst({ where: { id, tenantId }, select: { id: true, grupo: { select: { actividadId: true } } } })
  if (!i) return { success: false, error: 'Insumo no encontrado.' }
  await d.insumoGrupo.delete({ where: { id } })
  await invalidarPresupuesto(d, i.grupo.actividadId)
  revalidatePath('/core/actividades')
  return { success: true }
}

/** Cambia el estado de un insumo (REQUERIDO → APROBADO por el tesorero → CONSEGUIDO). */
export async function cambiarEstadoInsumo(id: string, estado: InsumoEstado) {
  const { db: d, tenantId } = await db(true)
  const i = await d.insumoGrupo.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!i) return { success: false, error: 'Insumo no encontrado.' }
  await d.insumoGrupo.update({ where: { id }, data: { estado } })
  revalidatePath('/core/actividades')
  return { success: true }
}

// ── Electores para elegir (responsable / miembros) ─────────────────────────────

export async function listElectoresParaActividad(): Promise<{ id: string; name: string; esSimpatizante: boolean }[]> {
  const { db: d, tenantId } = await db()
  return d.voter.findMany({ where: { tenantId }, select: { id: true, name: true, esSimpatizante: true }, orderBy: { name: 'asc' } })
}
