'use server'

/**
 * Server Actions de administración territorial (comunas, corregimientos,
 * barrios y puestos de votación) — solo ADMIN_CAMPANA y COORDINADOR.
 * Estas tablas no tienen tenantId: viven físicamente en la DB propia de
 * cada tenant (aislamiento por base de datos, no por columna).
 */

import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb }         from '@vectra/db'
import { coloresPorZona }      from '@/lib/colores-comuna'
import { resolverBarrios }     from '@/lib/barrios'
import { revalidatePath }      from 'next/cache'

export type CommuneKind = 'COMUNA' | 'CORREGIMIENTO'

export interface CommuneSummary {
  id:               string
  name:             string
  type:             CommuneKind
  neighborhoodCount: number
  /** Color con el que se distingue esta zona, igual aquí que en el mapa. */
  color:            string
  /** Si tiene polígono cargado; sin él no se puede dibujar en el mapa. */
  tieneLimites:     boolean
  /** Quién coordina esta comuna y sus barrios. */
  lider:            { id: string; name: string } | null
}

export interface NeighborhoodSummary {
  id:   string
  name: string
  /** Con quién se coordina lo que pasa en este barrio. */
  lider: { id: string; name: string } | null
  /** Electores ubicados adentro del polígono (ver lib/barrios.ts). */
  habitantes: number
}

export interface VotingStationSummary {
  id:           string
  name:         string
  address:      string
  lat:          number | null
  lng:          number | null
  specialLabel: string | null
  tablesCount:  number
}

async function dbTenant(tenantId: string) {
  return getTenantDb(await getTenantConnection(tenantId))
}

type Resultado = { success: true } | { success: false; error: string }

/** Municipio configurado para la elección (si existe), como default del selector de Territorio. */
export async function getDefaultMunicipioDivipola(): Promise<string | null> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO')
  const db      = await dbTenant(session.user.tenantId)
  const cfg     = await db.tenantConfig.findUnique({ where: { tenantId: session.user.tenantId } })
  return cfg?.electionMunicipalityDivipola ?? null
}

/** Resuelve un código DIVIPOLA a su Municipality.id interno, para las demás acciones. */
export async function getMunicipalityByDivipola(
  divipola: string,
): Promise<{ id: string; name: string; departmentCode: string } | null> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO')
  const db      = await dbTenant(session.user.tenantId)
  const m = await db.municipality.findUnique({
    where: { divipola }, select: { id: true, name: true, department: { select: { code: true } } },
  })
  return m ? { id: m.id, name: m.name, departmentCode: m.department.code } : null
}

// ── Comunas / corregimientos ────────────────────────────────────────────────

export async function listCommunes(municipalityId: string): Promise<CommuneSummary[]> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO')
  const db      = await dbTenant(session.user.tenantId)

  const comunas = await db.commune.findMany({
    where:   { municipalityId },
    include: { _count: { select: { neighborhoods: true } }, lider: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })

  // Esta consulta ya trae TODAS las zonas del municipio ordenadas por nombre,
  // que es exactamente el orden del que depende el color.
  const colores = coloresPorZona(comunas.map((c) => c.id))

  return comunas.map((c) => ({
    id: c.id, name: c.name, type: c.type as CommuneKind,
    neighborhoodCount: c._count.neighborhoods,
    color:        colores.get(c.id)!,
    tieneLimites: c.boundary !== null,
    lider:        c.lider,
  }))
}

export async function createCommune(
  data: { name: string; type: CommuneKind; municipalityId: string },
): Promise<Resultado & { communeId?: string }> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO', 'edit')
  const db      = await dbTenant(session.user.tenantId)

  const nombre = data.name.trim()
  if (!nombre) return { success: false, error: 'El nombre es obligatorio.' }

  const duplicado = await db.commune.findFirst({
    where: { municipalityId: data.municipalityId, name: { equals: nombre, mode: 'insensitive' } },
  })
  if (duplicado) return { success: false, error: `Ya existe "${nombre}" en este municipio.` }

  const comuna = await db.commune.create({
    data: { name: nombre, type: data.type, municipalityId: data.municipalityId },
  })

  revalidatePath('/core/territorio')
  return { success: true, communeId: comuna.id }
}

export async function updateCommune(
  id: string, data: { name?: string; type?: CommuneKind },
): Promise<Resultado> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO', 'edit')
  const db      = await dbTenant(session.user.tenantId)

  const nombre = data.name?.trim()
  if (data.name !== undefined && !nombre) return { success: false, error: 'El nombre es obligatorio.' }

  await db.commune.update({
    where: { id },
    data: {
      ...(nombre       !== undefined && { name: nombre }),
      ...(data.type     !== undefined && { type: data.type }),
    },
  })

  revalidatePath('/core/territorio')
  return { success: true }
}

// ── Barrios ──────────────────────────────────────────────────────────────────

export async function listNeighborhoods(communeId: string): Promise<NeighborhoodSummary[]> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO')
  const db      = await dbTenant(session.user.tenantId)

  const barrios = await db.neighborhood.findMany({
    where:   { communeId },
    include: { lider: { select: { id: true, name: true } }, _count: { select: { habitantes: true } } },
    orderBy: { name: 'asc' },
  })
  return barrios.map((b) => ({ id: b.id, name: b.name, lider: b.lider, habitantes: b._count.habitantes }))
}

export async function createNeighborhood(
  data: { name: string; communeId: string },
): Promise<Resultado & { neighborhoodId?: string }> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO', 'edit')
  const db      = await dbTenant(session.user.tenantId)

  const nombre = data.name.trim()
  if (!nombre) return { success: false, error: 'El nombre es obligatorio.' }

  const duplicado = await db.neighborhood.findFirst({
    where: { communeId: data.communeId, name: { equals: nombre, mode: 'insensitive' } },
  })
  if (duplicado) return { success: false, error: `Ya existe "${nombre}" en esta comuna.` }

  const barrio = await db.neighborhood.create({
    data: { name: nombre, communeId: data.communeId },
  })

  revalidatePath('/core/territorio')
  return { success: true, neighborhoodId: barrio.id }
}

export async function updateNeighborhood(id: string, data: { name: string }): Promise<Resultado> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO', 'edit')
  const db      = await dbTenant(session.user.tenantId)

  const nombre = data.name.trim()
  if (!nombre) return { success: false, error: 'El nombre es obligatorio.' }

  await db.neighborhood.update({ where: { id }, data: { name: nombre } })

  revalidatePath('/core/territorio')
  return { success: true }
}

// ── Puestos de votación ────────────────────────────────────────────────────

export async function listVotingStationsAdmin(municipalityId: string): Promise<VotingStationSummary[]> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO')
  const db      = await dbTenant(session.user.tenantId)

  const puestos = await db.votingStation.findMany({
    where:   { municipalityId },
    include: { _count: { select: { tables: true } } },
    orderBy: { name: 'asc' },
  })

  return puestos.map((p) => ({
    id: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng,
    specialLabel: p.specialLabel, tablesCount: p._count.tables,
  }))
}

export async function createVotingStation(
  data: { name: string; address: string; municipalityId: string; lat?: number; lng?: number; specialLabel?: string },
): Promise<Resultado & { stationId?: string }> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO', 'edit')
  const db      = await dbTenant(session.user.tenantId)

  const nombre = data.name.trim()
  if (!nombre) return { success: false, error: 'El nombre es obligatorio.' }

  const duplicado = await db.votingStation.findFirst({
    where: { municipalityId: data.municipalityId, name: { equals: nombre, mode: 'insensitive' } },
  })
  if (duplicado) return { success: false, error: `Ya existe "${nombre}" en este municipio.` }

  const puesto = await db.votingStation.create({
    data: {
      name: nombre,
      address: data.address.trim(),
      municipalityId: data.municipalityId,
      lat: data.lat, lng: data.lng,
      specialLabel: data.specialLabel?.trim() || undefined,
    },
  })

  revalidatePath('/core/territorio')
  revalidatePath('/core')
  return { success: true, stationId: puesto.id }
}

export async function updateVotingStation(
  id: string,
  data: { name?: string; address?: string; lat?: number; lng?: number; specialLabel?: string },
): Promise<Resultado> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO', 'edit')
  const db      = await dbTenant(session.user.tenantId)

  const nombre = data.name?.trim()
  if (data.name !== undefined && !nombre) return { success: false, error: 'El nombre es obligatorio.' }

  await db.votingStation.update({
    where: { id },
    data: {
      ...(nombre                !== undefined && { name: nombre }),
      ...(data.address          !== undefined && { address: data.address.trim() }),
      ...(data.lat              !== undefined && { lat: data.lat }),
      ...(data.lng              !== undefined && { lng: data.lng }),
      ...(data.specialLabel     !== undefined && { specialLabel: data.specialLabel.trim() || null }),
    },
  })

  revalidatePath('/core/territorio')
  revalidatePath('/core')
  return { success: true }
}

// ── Sede de campaña ─────────────────────────────────────────────────────────
// Una sola por campaña (ver TenantConfig): es el techo de la cadena
// sede → líder de comuna → líder de barrio.

export interface Sede {
  nombre:    string | null
  direccion: string | null
  lider:     { id: string; name: string } | null
}

export async function getSede(): Promise<Sede> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO')
  const db      = await dbTenant(session.user.tenantId)

  const cfg = await db.tenantConfig.findUnique({ where: { tenantId: session.user.tenantId } })
  const lider = cfg?.sedeLiderId
    ? await db.voter.findFirst({ where: { id: cfg.sedeLiderId, tenantId: session.user.tenantId }, select: { id: true, name: true } })
    : null

  return { nombre: cfg?.sedeNombre ?? null, direccion: cfg?.sedeDireccion ?? null, lider }
}

export async function guardarSede(
  data: { nombre?: string; direccion?: string; liderId?: string | null },
): Promise<Resultado> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO', 'edit')
  const tenantId = session.user.tenantId
  const db       = await dbTenant(tenantId)

  if (data.liderId && !(await db.voter.findFirst({ where: { id: data.liderId, tenantId }, select: { id: true } }))) {
    return { success: false, error: 'Ese elector no existe en esta campaña.' }
  }

  const campos: Record<string, unknown> = {}
  if (data.nombre    !== undefined) campos.sedeNombre    = data.nombre.trim() || null
  if (data.direccion !== undefined) campos.sedeDireccion = data.direccion.trim() || null
  if (data.liderId   !== undefined) campos.sedeLiderId   = data.liderId

  await db.tenantConfig.upsert({
    where:  { tenantId },
    update: campos,
    create: { tenantId, ...campos },
  })

  revalidatePath('/core/territorio')
  return { success: true }
}

// ── Líderes territoriales ───────────────────────────────────────────────────
// Cargo por territorio, aparte del árbol de captación (Voter.leaderId): con
// quién se coordina lo que pasa en esa comuna o en ese barrio.

/** Asigna (o quita, con null) el líder de una comuna o corregimiento. */
export async function asignarLiderComuna(communeId: string, liderId: string | null): Promise<Resultado> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO', 'edit')
  const db      = await dbTenant(session.user.tenantId)

  if (liderId && !(await db.voter.findFirst({ where: { id: liderId, tenantId: session.user.tenantId }, select: { id: true } }))) {
    return { success: false, error: 'Ese elector no existe en esta campaña.' }
  }

  await db.commune.update({ where: { id: communeId }, data: { liderId } })
  revalidatePath('/core/territorio')
  return { success: true }
}

/** Asigna (o quita, con null) el líder de un barrio o vereda. */
export async function asignarLiderBarrio(neighborhoodId: string, liderId: string | null): Promise<Resultado> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO', 'edit')
  const db      = await dbTenant(session.user.tenantId)

  if (liderId && !(await db.voter.findFirst({ where: { id: liderId, tenantId: session.user.tenantId }, select: { id: true } }))) {
    return { success: false, error: 'Ese elector no existe en esta campaña.' }
  }

  await db.neighborhood.update({ where: { id: neighborhoodId }, data: { liderId } })
  revalidatePath('/core/territorio')
  return { success: true }
}

/**
 * Ubica en su barrio a los electores que todavía no lo tienen, cruzando sus
 * coordenadas contra los polígonos. Se corre después de importar un padrón o
 * de cargar límites nuevos; es idempotente.
 */
export async function resolverBarriosPendientes(): Promise<{ resueltos: number; fueraDePoligono: number }> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_TERRITORIO', 'edit')
  const db      = await dbTenant(session.user.tenantId)

  const r = await resolverBarrios(db, session.user.tenantId)
  revalidatePath('/core/territorio')
  revalidatePath('/core')
  return r
}
