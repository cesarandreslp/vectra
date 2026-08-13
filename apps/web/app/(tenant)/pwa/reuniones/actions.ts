'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth-helpers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { idsSubarbol } from '@/app/(tenant)/core/actions'

export interface ReunionListado {
  id:        string
  title:     string
  date:      string
  tipo:      'RED_INTERNA' | 'RECLUTAMIENTO'
  asistentes: { id: string; name: string }[]
  prospectos: { id: string; name: string; phone: string | null; notes: string | null }[]
}

/** Reuniones convocadas por el elector logueado, con quién asistió o qué prospectos trajo. */
export async function listarReuniones(): Promise<ReunionListado[]> {
  // Mismos roles que puede tener cualquier sesión dentro de /pwa (ver
  // pwa/layout.tsx) — el control real de acceso es tener voterId, no el rol:
  // staff (ADMIN_CAMPANA/COORDINADOR/TESTIGO) normalmente no lo tiene y
  // recibe listas vacías en vez de un throw que rompería la pantalla.
  const session = await requireAuth(['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR'])
  if (!session.user.voterId) return []

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  const reuniones = await db.meeting.findMany({
    where:   { tenantId: session.user.tenantId, leaderId: session.user.voterId },
    include: {
      attendees:  { include: { voter: { select: { id: true, name: true } } } },
      prospectos: true,
    },
    orderBy: { date: 'desc' },
  })

  return reuniones.map((r) => ({
    id:    r.id,
    title: r.title,
    date:  r.date.toISOString(),
    tipo:  r.tipo,
    asistentes: r.attendees.map((a) => ({ id: a.voter.id, name: a.voter.name })),
    prospectos: r.prospectos.map((p) => ({ id: p.id, name: p.name, phone: p.phone, notes: p.notes })),
  }))
}

/** Convoca una nueva reunión — RED_INTERNA con tu gente ya registrada, o RECLUTAMIENTO con prospectos. */
export async function crearReunion(title: string, date: string, tipo: 'RED_INTERNA' | 'RECLUTAMIENTO' = 'RED_INTERNA') {
  const session = await requireAuth(['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR'])
  if (!session.user.voterId) return { success: false, error: 'Cuenta sin elector enlazado.' }
  if (!title.trim()) return { success: false, error: 'Falta el título.' }

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  await db.meeting.create({
    data: {
      tenantId: session.user.tenantId,
      leaderId: session.user.voterId,
      title:    title.trim(),
      date:     new Date(date),
      tipo,
    },
  })

  revalidatePath('/pwa/reuniones')
  return { success: true }
}

/** Agrega un prospecto (persona sin cuenta) a una reunión RECLUTAMIENTO propia. */
export async function agregarProspecto(meetingId: string, name: string, phone?: string, notes?: string) {
  const session = await requireAuth(['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR'])
  if (!session.user.voterId) return { success: false, error: 'Cuenta sin elector enlazado.' }
  if (!name.trim()) return { success: false, error: 'Falta el nombre.' }

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  const meeting = await db.meeting.findFirst({
    where: { id: meetingId, tenantId: session.user.tenantId, leaderId: session.user.voterId },
  })
  if (!meeting) return { success: false, error: 'Reunión no encontrada.' }
  if (meeting.tipo !== 'RECLUTAMIENTO') return { success: false, error: 'Solo aplica a reuniones de reclutamiento.' }

  await db.meetingProspecto.create({
    data: { meetingId, name: name.trim(), phone: phone?.trim() || undefined, notes: notes?.trim() || undefined },
  })

  revalidatePath('/pwa/reuniones')
  return { success: true }
}

/** Quita un prospecto agregado por error. */
export async function quitarProspecto(prospectoId: string) {
  const session = await requireAuth(['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR'])
  if (!session.user.voterId) return { success: false, error: 'Cuenta sin elector enlazado.' }

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  const prospecto = await db.meetingProspecto.findFirst({
    where: { id: prospectoId, meeting: { tenantId: session.user.tenantId, leaderId: session.user.voterId } },
  })
  if (!prospecto) return { success: false, error: 'Prospecto no encontrado.' }

  await db.meetingProspecto.delete({ where: { id: prospectoId } })
  revalidatePath('/pwa/reuniones')
  return { success: true }
}

/** Marca o quita la asistencia de un elector de su propia red a una reunión que convocó. */
export async function marcarAsistencia(meetingId: string, voterId: string, asistio: boolean) {
  const session = await requireAuth(['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR'])
  if (!session.user.voterId) return { success: false, error: 'Cuenta sin elector enlazado.' }

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  const meeting = await db.meeting.findFirst({
    where: { id: meetingId, tenantId: session.user.tenantId, leaderId: session.user.voterId },
  })
  if (!meeting) return { success: false, error: 'Reunión no encontrada.' }

  const permitidos = await idsSubarbol(session.user.voterId, session.user.tenantId, db)
  if (!permitidos.has(voterId)) return { success: false, error: 'Ese elector no es de tu red.' }

  if (asistio) {
    await db.meetingAttendance.upsert({
      where:  { meetingId_voterId: { meetingId, voterId } },
      create: { meetingId, voterId },
      update: {},
    })
  } else {
    await db.meetingAttendance.deleteMany({ where: { meetingId, voterId } })
  }

  revalidatePath('/pwa/reuniones')
  return { success: true }
}
