'use server'

/**
 * Server Actions de administración territorial (comunas, corregimientos,
 * barrios y puestos de votación) — solo ADMIN_CAMPANA y COORDINADOR.
 * Estas tablas no tienen tenantId: viven físicamente en la DB propia de
 * cada tenant (aislamiento por base de datos, no por columna).
 */

import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb }         from '@campaignos/db'
import { coloresPorZona }      from '@/lib/colores-comuna'
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
}

export interface NeighborhoodSummary {
  id:   string
  name: string
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
    include: { _count: { select: { neighborhoods: true } } },
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
    where: { communeId }, orderBy: { name: 'asc' },
  })
  return barrios.map((b) => ({ id: b.id, name: b.name }))
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
