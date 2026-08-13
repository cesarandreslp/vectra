'use server'

/**
 * Buscador de perfiles entre los simpatizantes — para armar los grupos con la
 * gente que sirve ("3 con moto libres el sábado por la mañana") en vez de
 * preguntar por WhatsApp.
 *
 * Es información personal que la gente cargó de sí misma (Ley 1581): se accede
 * con permiso sobre esta pantalla, y NO devuelve cédula ni teléfono.
 */

import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { type Vehiculo } from '@/lib/perfil'

const SCREEN = 'CORE_PERFILES'

async function db() {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], SCREEN, 'view')
  return { db: getTenantDb(await getTenantConnection(session.user.tenantId)), tenantId: session.user.tenantId }
}

export interface FiltroPerfiles {
  /** Texto libre: cruza contra oficio, habilidades, herramientas y experiencia. */
  busqueda?: string
  /** Tokens de disponibilidad (ej. "SAB_MANANA"): tiene que poder en TODOS los pedidos. */
  disponibilidad?: string[]
  vehiculo?: Vehiculo
  /** Barrio donde vive, resuelto desde sus coordenadas (ver lib/barrios.ts). */
  neighborhoodId?: string
}

export interface PerfilEncontrado {
  voterId: string; name: string
  oficio: string | null; habilidades: string[]; herramientas: string[]
  disponibilidad: string[]; vehiculo: string; nivelEducativo: string | null
  experiencia: string | null; zonaAccion: string | null; aceptaWhatsapp: boolean
  actividades: number
  /** Dónde vive de verdad. null si todavía no se geocodificó su dirección. */
  barrio: string | null
  tituloEn: string | null
  posgrado: string | null
  posgradoEn: string | null
  certificaciones: string[]
}

export interface BarrioOpcion { id: string; name: string; comuna: string }

/**
 * Barrios en los que vive al menos un simpatizante con perfil cargado — son los
 * únicos que sirven de filtro: el resto siempre daría cero.
 */
export async function listarBarriosConPerfiles(): Promise<BarrioOpcion[]> {
  const { db: d, tenantId } = await db()

  const barrios = await d.neighborhood.findMany({
    where:   { habitantes: { some: { tenantId, perfil: { isNot: null } } } },
    select:  { id: true, name: true, commune: { select: { name: true } } },
    orderBy: { name: 'asc' },
  })
  return barrios.map((b) => ({ id: b.id, name: b.name, comuna: b.commune.name }))
}

export async function buscarPerfiles(filtro: FiltroPerfiles): Promise<PerfilEncontrado[]> {
  const { db: d, tenantId } = await db()
  const texto = filtro.busqueda?.trim().toLowerCase()

  const perfiles = await d.perfilSimpatizante.findMany({
    where: {
      tenantId,
      ...(filtro.vehiculo ? { vehiculo: filtro.vehiculo } : {}),
      ...(filtro.neighborhoodId ? { voter: { neighborhoodId: filtro.neighborhoodId } } : {}),
      // hasEvery: tiene que estar libre en TODAS las franjas pedidas, no en alguna.
      ...(filtro.disponibilidad?.length ? { disponibilidad: { hasEvery: filtro.disponibilidad } } : {}),
      ...(texto
        ? {
            OR: [
              { oficio:          { contains: texto, mode: 'insensitive' as const } },
              { experiencia:     { contains: texto, mode: 'insensitive' as const } },
              { tituloEn:        { contains: texto, mode: 'insensitive' as const } },
              { posgradoEn:      { contains: texto, mode: 'insensitive' as const } },
              { habilidades:     { has: texto } },
              { herramientas:    { has: texto } },
              { certificaciones: { has: texto } },
            ],
          }
        : {}),
    },
    include: {
      voter: {
        select: {
          id: true, name: true,
          neighborhood: { select: { name: true } },
          _count: { select: { membresiasGrupo: true } },
        },
      },
    },
    orderBy: { actualizadoEn: 'desc' },
    take: 100,
  })

  return perfiles.map((p) => ({
    voterId: p.voter.id, name: p.voter.name,
    oficio: p.oficio, habilidades: p.habilidades, herramientas: p.herramientas,
    disponibilidad: p.disponibilidad, vehiculo: p.vehiculo,
    nivelEducativo: p.nivelEducativo, experiencia: p.experiencia,
    zonaAccion: p.zonaAccion, aceptaWhatsapp: p.aceptaWhatsapp,
    actividades: p.voter._count.membresiasGrupo,
    barrio: p.voter.neighborhood?.name ?? null,
    tituloEn: p.tituloEn, posgrado: p.posgrado, posgradoEn: p.posgradoEn,
    certificaciones: p.certificaciones,
  }))
}
