'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth-helpers'
import { type UserRole } from '@campaignos/auth'
import { getTenantDb } from '@campaignos/db'
import { getTenantConnection } from '@/lib/tenant'
import { idsLideres } from '@/app/(tenant)/core/actions'

// Mismos roles que puede tener cualquier sesión dentro de /pwa (pwa/layout.tsx)
// — el control real de acceso es tener voterId, no el rol.
const ROLES_PWA: UserRole[] = ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR']

async function esAnfitrion(voterId: string, tenantId: string, db: ReturnType<typeof getTenantDb>): Promise<boolean> {
  const v = await db.voter.findFirst({ where: { id: voterId, tenantId }, select: { isCandidate: true, tieneAgenda: true } })
  return Boolean(v?.isCandidate || v?.tieneAgenda)
}

/** Si soy candidato o jefe de debate — determina qué modo de la pantalla de agenda mostrar. */
export async function soyAnfitrion(): Promise<boolean> {
  const session = await requireAuth(ROLES_PWA)
  if (!session.user.voterId) return false
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))
  return esAnfitrion(session.user.voterId, session.user.tenantId, db)
}

// ── Anfitriones (candidato + jefes de debate) ──────────────────────────────────

export interface AnfitrionOption {
  id: string
  name: string
  isCandidate: boolean
}

/** Quiénes tienen agenda propia reservable — para que el elector elija con quién reunirse. */
export async function listarAnfitriones(): Promise<AnfitrionOption[]> {
  const session = await requireAuth(ROLES_PWA)
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  return db.voter.findMany({
    where:   { tenantId: session.user.tenantId, OR: [{ isCandidate: true }, { tieneAgenda: true }] },
    select:  { id: true, name: true, isCandidate: true },
    orderBy: [{ isCandidate: 'desc' }, { name: 'asc' }],
  })
}

// ── Gestión de la propia agenda (anfitrión) ────────────────────────────────────

export interface EntradaAgenda {
  id:           string
  startsAt:     string
  endsAt:       string
  disponible:   boolean
  titulo:       string | null
  reservadoPor: string | null
  reservanteName: string | null
  motivo:       string | null
}

/** Todas las entradas propias del anfitrión (compromisos + huecos), para gestionar su calendario. */
export async function getMiAgenda(): Promise<EntradaAgenda[]> {
  const session = await requireAuth(ROLES_PWA)
  if (!session.user.voterId) return []

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))
  if (!(await esAnfitrion(session.user.voterId, session.user.tenantId, db))) return []

  const entradas = await db.agendaEntrada.findMany({
    where:   { tenantId: session.user.tenantId, anfitrionId: session.user.voterId },
    include: { reservante: { select: { name: true } } },
    orderBy: { startsAt: 'asc' },
  })

  return entradas.map((e) => ({
    id: e.id, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(),
    disponible: e.disponible, titulo: e.titulo, reservadoPor: e.reservadoPor,
    reservanteName: e.reservante?.name ?? null, motivo: e.motivo,
  }))
}

/** Publica un hueco disponible o bloquea un compromiso privado. */
export async function crearEntradaAgenda(data: {
  startsAt: string; endsAt: string; disponible: boolean; titulo?: string
}) {
  const session = await requireAuth(ROLES_PWA)
  if (!session.user.voterId) return { success: false, error: 'Cuenta sin elector enlazado.' }

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))
  if (!(await esAnfitrion(session.user.voterId, session.user.tenantId, db))) {
    return { success: false, error: 'Solo el candidato o un jefe de debate puede publicar agenda.' }
  }

  const startsAt = new Date(data.startsAt)
  const endsAt   = new Date(data.endsAt)
  if (!(endsAt > startsAt)) return { success: false, error: 'La hora de fin debe ser después de la de inicio.' }
  if (!data.disponible && !data.titulo?.trim()) return { success: false, error: 'Falta el título del compromiso.' }

  await db.agendaEntrada.create({
    data: {
      tenantId: session.user.tenantId, anfitrionId: session.user.voterId,
      startsAt, endsAt, disponible: data.disponible,
      titulo: data.disponible ? undefined : data.titulo!.trim(),
    },
  })

  revalidatePath('/pwa/agenda')
  return { success: true }
}

/** Borra una entrada propia — bloqueado si ya fue reservada (avisar al elector aparte primero). */
export async function eliminarEntradaAgenda(id: string) {
  const session = await requireAuth(ROLES_PWA)
  if (!session.user.voterId) return { success: false, error: 'Cuenta sin elector enlazado.' }

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))
  const entrada = await db.agendaEntrada.findFirst({
    where: { id, tenantId: session.user.tenantId, anfitrionId: session.user.voterId },
  })
  if (!entrada) return { success: false, error: 'Entrada no encontrada.' }
  if (entrada.reservadoPor) return { success: false, error: 'Ya fue reservada — avisa directo antes de borrarla.' }

  await db.agendaEntrada.delete({ where: { id } })
  revalidatePath('/pwa/agenda')
  return { success: true }
}

// ── Reserva (elector) ──────────────────────────────────────────────────────────

export interface HuecoDisponible {
  id: string
  startsAt: string
  endsAt: string
}

/** Huecos abiertos (futuros, sin reservar) de un anfitrión — sin ningún otro detalle. */
export async function getHuecosDisponibles(anfitrionId: string): Promise<HuecoDisponible[]> {
  const session = await requireAuth(ROLES_PWA)
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  // Solo la agenda del candidato es reservable, y solo mientras esté abierta.
  const anfitrion = await db.voter.findFirst({
    where:  { id: anfitrionId, tenantId: session.user.tenantId },
    select: { isCandidate: true, agendaAbierta: true },
  })
  if (!anfitrion?.isCandidate || !anfitrion.agendaAbierta) return []

  const huecos = await db.agendaEntrada.findMany({
    where: {
      tenantId: session.user.tenantId, anfitrionId,
      disponible: true, reservadoPor: null, startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: 'asc' },
    select: { id: true, startsAt: true, endsAt: true },
  })

  return huecos.map((h) => ({ id: h.id, startsAt: h.startsAt.toISOString(), endsAt: h.endsAt.toISOString() }))
}

/** Reserva un hueco — falla si alguien más lo tomó primero (condición de carrera). */
export async function reservarHueco(entradaId: string, motivo?: string) {
  const session = await requireAuth(ROLES_PWA)
  if (!session.user.voterId) return { success: false, error: 'Cuenta sin elector enlazado.' }

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  // La entrada debe ser de la agenda del candidato y estar abierta a reservas.
  const entrada = await db.agendaEntrada.findFirst({
    where:  { id: entradaId, tenantId: session.user.tenantId },
    select: { anfitrion: { select: { isCandidate: true, agendaAbierta: true } } },
  })
  if (!entrada?.anfitrion.isCandidate || !entrada.anfitrion.agendaAbierta) {
    return { success: false, error: 'La agenda no está abierta a reservas.' }
  }

  const resultado = await db.agendaEntrada.updateMany({
    where: { id: entradaId, tenantId: session.user.tenantId, disponible: true, reservadoPor: null },
    data:  { reservadoPor: session.user.voterId, motivo: motivo?.trim() || undefined },
  })
  if (resultado.count === 0) return { success: false, error: 'Ese hueco ya no está disponible — elige otro.' }

  revalidatePath('/pwa/agenda')
  return { success: true }
}

/** Mis reservas ya hechas (con quién y cuándo), para verlas de un vistazo. */
export async function getMisReservas(): Promise<(EntradaAgenda & { anfitrionName: string })[]> {
  const session = await requireAuth(ROLES_PWA)
  if (!session.user.voterId) return []

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))
  const reservas = await db.agendaEntrada.findMany({
    where:   { tenantId: session.user.tenantId, reservadoPor: session.user.voterId },
    include: { anfitrion: { select: { name: true } } },
    orderBy: { startsAt: 'asc' },
  })

  return reservas.map((e) => ({
    id: e.id, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(),
    disponible: e.disponible, titulo: e.titulo, reservadoPor: e.reservadoPor,
    reservanteName: null, motivo: e.motivo, anfitrionName: e.anfitrion.name,
  }))
}

// ── Convocatorias (top-down: candidato/jefe → electores) ───────────────────────

export type SeleccionDestinatarios =
  | { modo: 'todos' }
  | { modo: 'lideres' }
  | { modo: 'zona'; zona: string }
  | { modo: 'individual'; voterIds: string[] }

export interface ConvocatoriaListado {
  id: string
  titulo: string
  startsAt: string
  lugar: string | null
  convocanteName: string
  totalDestinatarios: number
}

async function resolverDestinatarios(
  sel: SeleccionDestinatarios, tenantId: string, db: ReturnType<typeof getTenantDb>,
): Promise<string[]> {
  if (sel.modo === 'todos') {
    const todos = await db.voter.findMany({ where: { tenantId }, select: { id: true } })
    return todos.map((v) => v.id)
  }
  if (sel.modo === 'lideres') {
    return [...(await idsLideres(tenantId, db))]
  }
  if (sel.modo === 'zona') {
    const enZona = await db.voter.findMany({ where: { tenantId, zone: sel.zona }, select: { id: true } })
    return enZona.map((v) => v.id)
  }
  return sel.voterIds
}

/** Lista liviana de electores (id, nombre, zona) para armar la selección individual. */
export async function listarElectoresParaConvocar(): Promise<{ id: string; name: string; zone: string | null }[]> {
  const session = await requireAuth(ROLES_PWA)
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  return db.voter.findMany({
    where:   { tenantId: session.user.tenantId },
    select:  { id: true, name: true, zone: true },
    orderBy: { name: 'asc' },
  })
}

/** Convoca a electores (candidato/jefe de debate) — todos, por líderes, por zona, o selección puntual. */
export async function crearConvocatoria(data: {
  titulo: string; startsAt: string; lugar?: string; destinatarios: SeleccionDestinatarios
}) {
  const session = await requireAuth(ROLES_PWA)
  if (!session.user.voterId) return { success: false, error: 'Cuenta sin elector enlazado.' }
  if (!data.titulo.trim()) return { success: false, error: 'Falta el título.' }

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))
  if (!(await esAnfitrion(session.user.voterId, session.user.tenantId, db))) {
    return { success: false, error: 'Solo el candidato o un jefe de debate puede convocar.' }
  }

  const voterIds = await resolverDestinatarios(data.destinatarios, session.user.tenantId, db)
  if (voterIds.length === 0) return { success: false, error: 'No hay electores en esa selección.' }

  await db.convocatoria.create({
    data: {
      tenantId: session.user.tenantId, convocanteId: session.user.voterId,
      titulo: data.titulo.trim(), startsAt: new Date(data.startsAt), lugar: data.lugar?.trim() || undefined,
      destinatarios: { create: voterIds.map((voterId) => ({ voterId })) },
    },
  })

  revalidatePath('/pwa/reuniones')
  return { success: true }
}

/** Convocatorias que YO organicé, con cuántos destinatarios tiene cada una. */
export async function getConvocatoriasCreadas(): Promise<ConvocatoriaListado[]> {
  const session = await requireAuth(ROLES_PWA)
  if (!session.user.voterId) return []

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))
  const convocatorias = await db.convocatoria.findMany({
    where:   { tenantId: session.user.tenantId, convocanteId: session.user.voterId },
    include: { convocante: { select: { name: true } }, _count: { select: { destinatarios: true } } },
    orderBy: { startsAt: 'desc' },
  })

  return convocatorias.map((c) => ({
    id: c.id, titulo: c.titulo, startsAt: c.startsAt.toISOString(), lugar: c.lugar,
    convocanteName: c.convocante.name, totalDestinatarios: c._count.destinatarios,
  }))
}

/** A qué estoy convocado — para que cualquier elector vea las convocatorias del candidato/jefes. */
export async function getMisConvocatorias(): Promise<ConvocatoriaListado[]> {
  const session = await requireAuth(ROLES_PWA)
  if (!session.user.voterId) return []

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))
  const destinos = await db.convocatoriaDestinatario.findMany({
    where:   { voterId: session.user.voterId, convocatoria: { tenantId: session.user.tenantId } },
    include: { convocatoria: { include: { convocante: { select: { name: true } }, _count: { select: { destinatarios: true } } } } },
    orderBy: { convocatoria: { startsAt: 'asc' } },
  })

  return destinos.map((d) => ({
    id: d.convocatoria.id, titulo: d.convocatoria.titulo, startsAt: d.convocatoria.startsAt.toISOString(),
    lugar: d.convocatoria.lugar, convocanteName: d.convocatoria.convocante.name,
    totalDestinatarios: d.convocatoria._count.destinatarios,
  }))
}
