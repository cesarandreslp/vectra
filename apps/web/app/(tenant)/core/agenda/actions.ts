'use server'

import { revalidatePath } from 'next/cache'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantDb } from '@campaignos/db'
import { getTenantConnection } from '@/lib/tenant'
import { getGestor, type AgendaAmbito } from '@/lib/agenda'

const ROLES_ADMIN = ['ADMIN_CAMPANA', 'COORDINADOR'] as const

export interface AnfitrionOption {
  id: string
  name: string
  isCandidate: boolean
}

/** Candidato + jefes de debate — para elegir de quién ver la agenda/convocatorias. */
export async function getAnfitrionesAdmin(): Promise<AnfitrionOption[]> {
  const session = await requireModuleOrScreen('CORE', [...ROLES_ADMIN], 'CORE_AGENDA')
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  return db.voter.findMany({
    where:   { tenantId: session.user.tenantId, OR: [{ isCandidate: true }, { tieneAgenda: true }] },
    select:  { id: true, name: true, isCandidate: true },
    orderBy: [{ isCandidate: 'desc' }, { name: 'asc' }],
  })
}

export interface EntradaAgendaAdmin {
  id:             string
  startsAt:       string
  endsAt:         string
  disponible:     boolean
  titulo:         string | null
  reservanteName: string | null
  motivo:         string | null
}

/** Agenda completa (compromisos + huecos, reservados o no) de un anfitrión puntual. */
export async function getAgendaDeAnfitrion(anfitrionId: string): Promise<EntradaAgendaAdmin[]> {
  const session = await requireModuleOrScreen('CORE', [...ROLES_ADMIN], 'CORE_AGENDA')
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  const entradas = await db.agendaEntrada.findMany({
    where:   { tenantId: session.user.tenantId, anfitrionId },
    include: { reservante: { select: { name: true } } },
    orderBy: { startsAt: 'asc' },
  })

  return entradas.map((e) => ({
    id: e.id, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(),
    disponible: e.disponible, titulo: e.titulo,
    reservanteName: e.reservante?.name ?? null, motivo: e.motivo,
  }))
}

// ── Gestión desde el admin (respaldo cuando no hay gestor de la agenda) ─────────
// Mismos criterios que crear/eliminar del anfitrión en la PWA, pero autorizado
// para el admin del tenant y actuando sobre la agenda de un anfitrión elegido.

async function anfitrionValido(anfitrionId: string, tenantId: string, db: ReturnType<typeof getTenantDb>) {
  return db.voter.findFirst({
    where:  { id: anfitrionId, tenantId, OR: [{ isCandidate: true }, { tieneAgenda: true }] },
    select: { id: true },
  })
}

/** Publica un hueco disponible o bloquea un compromiso en la agenda de un anfitrión. */
export async function crearEntradaAgendaAdmin(
  anfitrionId: string,
  data: { startsAt: string; endsAt: string; disponible: boolean; titulo?: string },
) {
  const session = await requireModuleOrScreen('CORE', [...ROLES_ADMIN], 'CORE_AGENDA')
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  if (!(await anfitrionValido(anfitrionId, session.user.tenantId, db))) {
    return { success: false, error: 'Solo el candidato o un jefe de debate tiene agenda.' }
  }

  const startsAt = new Date(data.startsAt)
  const endsAt   = new Date(data.endsAt)
  if (!(endsAt > startsAt)) return { success: false, error: 'La hora de fin debe ser después de la de inicio.' }
  if (!data.disponible && !data.titulo?.trim()) return { success: false, error: 'Falta el título del compromiso.' }

  await db.agendaEntrada.create({
    data: {
      tenantId: session.user.tenantId, anfitrionId,
      startsAt, endsAt, disponible: data.disponible,
      titulo: data.disponible ? undefined : data.titulo!.trim(),
    },
  })

  revalidatePath('/core/agenda')
  return { success: true }
}

/** Borra una entrada de la agenda de un anfitrión — bloqueado si ya fue reservada. */
export async function eliminarEntradaAgendaAdmin(entradaId: string) {
  const session = await requireModuleOrScreen('CORE', [...ROLES_ADMIN], 'CORE_AGENDA')
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  const entrada = await db.agendaEntrada.findFirst({
    where:  { id: entradaId, tenantId: session.user.tenantId },
    select: { id: true, reservadoPor: true },
  })
  if (!entrada) return { success: false, error: 'Entrada no encontrada.' }
  if (entrada.reservadoPor) return { success: false, error: 'Ya fue reservada — avisá al elector antes de borrarla.' }

  await db.agendaEntrada.delete({ where: { id: entradaId } })
  revalidatePath('/core/agenda')
  return { success: true }
}

// ── Gestión del ámbito: gestor ("doliente") y apertura/cierre con bitácora ──────

export interface GestionAgenda {
  gestorCandidato:  { id: string; name: string } | null
  gestorJefes:      { id: string; name: string } | null
  candidato:        { id: string; name: string; agendaAbierta: boolean } | null
  posiblesGestores: { id: string; name: string }[]
  bitacora:         { id: string; abierta: boolean; quien: string; motivo: string | null; createdAt: string }[]
}

/** Gestores por ámbito, apertura de la agenda del candidato y su bitácora. */
export async function getGestionAgenda(): Promise<GestionAgenda> {
  const session = await requireModuleOrScreen('CORE', [...ROLES_ADMIN], 'CORE_AGENDA')
  const tenantId = session.user.tenantId
  const db = getTenantDb(await getTenantConnection(tenantId))

  const [gestorCandidato, gestorJefes, candidato, posiblesGestores] = await Promise.all([
    getGestor('CANDIDATO', tenantId, db),
    getGestor('JEFES', tenantId, db),
    db.voter.findFirst({ where: { tenantId, isCandidate: true }, select: { id: true, name: true, agendaAbierta: true } }),
    db.voter.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  let bitacora: GestionAgenda['bitacora'] = []
  if (candidato) {
    const rows = await db.agendaApertura.findMany({
      where:   { tenantId, anfitrionId: candidato.id },
      include: { gestor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take:    20,
    })
    bitacora = rows.map((r) => ({
      id: r.id, abierta: r.abierta,
      quien: r.gestor?.name ?? 'Admin del tenant',
      motivo: r.motivo, createdAt: r.createdAt.toISOString(),
    }))
  }

  return { gestorCandidato, gestorJefes, candidato, posiblesGestores, bitacora }
}

/** Asigna un elector como gestor de un ámbito (a lo sumo uno por ámbito). */
export async function asignarGestor(voterId: string, ambito: AgendaAmbito) {
  const session = await requireModuleOrScreen('CORE', [...ROLES_ADMIN], 'CORE_AGENDA')
  const tenantId = session.user.tenantId
  const db = getTenantDb(await getTenantConnection(tenantId))

  const v = await db.voter.findFirst({ where: { id: voterId, tenantId }, select: { id: true } })
  if (!v) return { success: false, error: 'Elector no válido.' }

  await db.$transaction([
    db.voter.updateMany({ where: { tenantId, gestionaAgenda: ambito }, data: { gestionaAgenda: null } }),
    db.voter.update({ where: { id: voterId }, data: { gestionaAgenda: ambito } }),
  ])
  revalidatePath('/core/agenda')
  return { success: true }
}

/** Deja un ámbito sin gestor — vuelve a quedar el admin como responsable. */
export async function quitarGestor(ambito: AgendaAmbito) {
  const session = await requireModuleOrScreen('CORE', [...ROLES_ADMIN], 'CORE_AGENDA')
  const tenantId = session.user.tenantId
  const db = getTenantDb(await getTenantConnection(tenantId))
  await db.voter.updateMany({ where: { tenantId, gestionaAgenda: ambito }, data: { gestionaAgenda: null } })
  revalidatePath('/core/agenda')
  return { success: true }
}

/** Abre o cierra la agenda del candidato a reservas de electores, y lo registra en la bitácora. */
export async function toggleAgendaAbierta(abierta: boolean, motivo?: string) {
  const session = await requireModuleOrScreen('CORE', [...ROLES_ADMIN], 'CORE_AGENDA')
  const tenantId = session.user.tenantId
  const db = getTenantDb(await getTenantConnection(tenantId))

  const candidato = await db.voter.findFirst({ where: { tenantId, isCandidate: true }, select: { id: true } })
  if (!candidato) return { success: false, error: 'No hay candidato marcado.' }

  const gestor = await getGestor('CANDIDATO', tenantId, db)
  const soyGestor = Boolean(session.user.voterId) && session.user.voterId === gestor?.id

  await db.$transaction([
    db.voter.update({ where: { id: candidato.id }, data: { agendaAbierta: abierta } }),
    db.agendaApertura.create({
      data: {
        tenantId, anfitrionId: candidato.id, abierta,
        gestorId:    soyGestor ? gestor!.id : null,
        adminUserId: soyGestor ? null : session.user.userId,
        motivo:      motivo?.trim() || undefined,
      },
    }),
  ])
  revalidatePath('/core/agenda')
  return { success: true }
}

export interface ConvocatoriaAdminListado {
  id:                 string
  titulo:             string
  startsAt:           string
  lugar:              string | null
  totalDestinatarios: number
  destinatarios:      string[]
}

/** Convocatorias que ha enviado un anfitrión puntual, con la lista de a quién. */
export async function getConvocatoriasDeAnfitrion(anfitrionId: string): Promise<ConvocatoriaAdminListado[]> {
  const session = await requireModuleOrScreen('CORE', [...ROLES_ADMIN], 'CORE_AGENDA')
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  const convocatorias = await db.convocatoria.findMany({
    where:   { tenantId: session.user.tenantId, convocanteId: anfitrionId },
    include: { destinatarios: { include: { voter: { select: { name: true } } } } },
    orderBy: { startsAt: 'desc' },
  })

  return convocatorias.map((c) => ({
    id: c.id, titulo: c.titulo, startsAt: c.startsAt.toISOString(), lugar: c.lugar,
    totalDestinatarios: c.destinatarios.length,
    destinatarios: c.destinatarios.map((d) => d.voter.name),
  }))
}

export interface ReunionReclutamientoAdmin {
  id:              string
  title:           string
  date:            string
  organizadorName: string
  prospectos:      { name: string; phone: string | null; notes: string | null }[]
}

/** Reuniones de reclutamiento de TODOS los electores — para medir crecimiento de base. */
export async function getReunionesReclutamiento(): Promise<ReunionReclutamientoAdmin[]> {
  const session = await requireModuleOrScreen('CORE', [...ROLES_ADMIN], 'CORE_AGENDA')
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  // Meeting.leaderId es un string suelto (sin @relation) — se resuelve el
  // nombre del organizador aparte, en un solo lote.
  const reuniones = await db.meeting.findMany({
    where:   { tenantId: session.user.tenantId, tipo: 'RECLUTAMIENTO' },
    include: { prospectos: true },
    orderBy: { date: 'desc' },
  })

  const organizadores = await db.voter.findMany({
    where:  { id: { in: [...new Set(reuniones.map((r) => r.leaderId))] } },
    select: { id: true, name: true },
  })
  const nombrePorId = new Map(organizadores.map((v) => [v.id, v.name]))

  return reuniones.map((r) => ({
    id: r.id, title: r.title, date: r.date.toISOString(),
    organizadorName: nombrePorId.get(r.leaderId) ?? '(desconocido)',
    prospectos: r.prospectos.map((p) => ({ name: p.name, phone: p.phone, notes: p.notes })),
  }))
}
