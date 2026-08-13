'use server'

/**
 * Hoja de vida del simpatizante, escrita por él mismo desde el PWA.
 * Solo puede leer y escribir la SUYA: el voterId sale de la sesión, nunca de
 * la petición.
 */

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth-helpers'
import { type UserRole } from '@campaignos/auth'
import { getTenantDb } from '@campaignos/db'
import { getTenantConnection } from '@/lib/tenant'
import { type Vehiculo, type Nivel } from '@/lib/perfil'

const ROLES_PWA: UserRole[] = ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR']

export interface MiPerfil {
  oficio: string | null
  habilidades: string[]
  herramientas: string[]
  disponibilidad: string[]
  vehiculo: Vehiculo
  nivelEducativo: Nivel | null
  experiencia: string | null
  zonaAccion: string | null
  aceptaWhatsapp: boolean
  nota: string | null
}

const VACIO: MiPerfil = {
  oficio: null, habilidades: [], herramientas: [], disponibilidad: [],
  vehiculo: 'NINGUNO', nivelEducativo: null, experiencia: null,
  zonaAccion: null, aceptaWhatsapp: false, nota: null,
}

async function ctx() {
  const session = await requireAuth(ROLES_PWA)
  return {
    voterId:  session.user.voterId,
    tenantId: session.user.tenantId,
    db:       getTenantDb(await getTenantConnection(session.user.tenantId)),
  }
}

export async function getMiPerfil(): Promise<MiPerfil | null> {
  const { db, tenantId, voterId } = await ctx()
  if (!voterId) return null

  const v = await db.voter.findFirst({
    where:  { id: voterId, tenantId },
    select: { esSimpatizante: true, perfil: true },
  })
  if (!v) return null

  const p = v.perfil
  if (!p) return VACIO
  return {
    oficio: p.oficio, habilidades: p.habilidades, herramientas: p.herramientas,
    disponibilidad: p.disponibilidad, vehiculo: p.vehiculo as Vehiculo,
    nivelEducativo: (p.nivelEducativo as Nivel | null) ?? null,
    experiencia: p.experiencia, zonaAccion: p.zonaAccion,
    aceptaWhatsapp: p.aceptaWhatsapp, nota: p.nota,
  }
}

export async function guardarMiPerfil(data: MiPerfil) {
  const { db, tenantId, voterId } = await ctx()
  if (!voterId) return { success: false, error: 'Sin sesión de elector.' }

  const v = await db.voter.findFirst({ where: { id: voterId, tenantId }, select: { id: true } })
  if (!v) return { success: false, error: 'Elector no encontrado.' }

  const campos = {
    oficio: data.oficio?.trim() || null,
    habilidades: data.habilidades,
    herramientas: data.herramientas,
    disponibilidad: data.disponibilidad,
    vehiculo: data.vehiculo,
    nivelEducativo: data.nivelEducativo,
    experiencia: data.experiencia?.trim() || null,
    zonaAccion: data.zonaAccion?.trim() || null,
    aceptaWhatsapp: data.aceptaWhatsapp,
    nota: data.nota?.trim() || null,
  }

  await db.perfilSimpatizante.upsert({
    where:  { voterId },
    update: campos,
    create: { tenantId, voterId, ...campos },
  })
  // Quien se ofrece para las actividades ya es, de hecho, un simpatizante.
  await db.voter.update({ where: { id: voterId }, data: { esSimpatizante: true } })

  revalidatePath('/pwa/perfil')
  return { success: true }
}
