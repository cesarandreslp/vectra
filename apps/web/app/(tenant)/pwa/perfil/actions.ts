'use server'

/**
 * Hoja de vida del simpatizante, escrita por él mismo desde el PWA.
 * Solo puede leer y escribir la SUYA: el voterId sale de la sesión, nunca de
 * la petición.
 */

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth-helpers'
import { type UserRole } from '@vectra/auth'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { SUGERENCIAS, mezclarOpciones, normalizar, NIVELES_CON_TITULO, type Vehiculo, type Nivel, type Posgrado } from '@/lib/perfil'

const ROLES_PWA: UserRole[] = ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR']

export interface MiPerfil {
  oficio: string | null
  habilidades: string[]
  herramientas: string[]
  disponibilidad: string[]
  vehiculo: Vehiculo
  nivelEducativo: Nivel | null
  tituloEn: string | null
  posgrado: Posgrado | null
  posgradoEn: string | null
  certificaciones: string[]
  experiencia: string | null
  zonaAccion: string | null
  aceptaWhatsapp: boolean
  nota: string | null
}

const VACIO: MiPerfil = {
  oficio: null, habilidades: [], herramientas: [], disponibilidad: [],
  vehiculo: 'NINGUNO', nivelEducativo: null, tituloEn: null,
  posgrado: null, posgradoEn: null, certificaciones: [],
  experiencia: null, zonaAccion: null, aceptaWhatsapp: false, nota: null,
}

export interface Vocabulario {
  oficios: string[]; habilidades: string[]; herramientas: string[]
  certificaciones: string[]; titulos: string[]
}

/**
 * Las opciones de cada desplegable: las semillas más TODO lo que ya escribió la
 * gente de esta campaña. No hay tabla de catálogo — el catálogo son los perfiles
 * mismos, así lo que alguien digita queda disponible para el que sigue.
 */
export async function getVocabulario(): Promise<Vocabulario> {
  const { db, tenantId } = await ctx()

  // ponytail: lee los perfiles del tenant en memoria. Con decenas de miles habría
  // que pasarlo a un DISTINCT/unnest en SQL crudo; a escala de una campaña no.
  const perfiles = await db.perfilSimpatizante.findMany({
    where:  { tenantId },
    select: { oficio: true, habilidades: true, herramientas: true, certificaciones: true, tituloEn: true, posgradoEn: true },
  })

  const juntar = (f: (p: (typeof perfiles)[number]) => string[] | string | null) =>
    perfiles.flatMap((p) => { const v = f(p); return v ? (Array.isArray(v) ? v : [v]) : [] })

  return {
    oficios:         mezclarOpciones(SUGERENCIAS.oficios, juntar((p) => p.oficio)),
    habilidades:     mezclarOpciones(SUGERENCIAS.habilidades, juntar((p) => p.habilidades)),
    herramientas:    mezclarOpciones(SUGERENCIAS.herramientas, juntar((p) => p.herramientas)),
    certificaciones: mezclarOpciones(SUGERENCIAS.certificaciones, juntar((p) => p.certificaciones)),
    titulos:         mezclarOpciones(SUGERENCIAS.titulos, [...juntar((p) => p.tituloEn), ...juntar((p) => p.posgradoEn)]),
  }
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
    // Los perfiles viejos guardaban POSGRADO como nivel; ahora el nivel es el
    // título de base y el posgrado va aparte. Se lee como profesional y la
    // persona elige cuál posgrado: no se inventa acá cuál era.
    nivelEducativo: p.nivelEducativo === 'POSGRADO' ? 'UNIVERSITARIO' : ((p.nivelEducativo as Nivel | null) ?? null),
    tituloEn: p.tituloEn,
    posgrado: (p.posgrado as Posgrado | null) ?? null,
    posgradoEn: p.posgradoEn,
    certificaciones: p.certificaciones,
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
    oficio: normalizar(data.oficio ?? '') || null,
    habilidades: data.habilidades,
    herramientas: data.herramientas,
    disponibilidad: data.disponibilidad,
    vehiculo: data.vehiculo,
    nivelEducativo: data.nivelEducativo,
    // Solo de técnico para arriba: si baja el nivel, el título deja de aplicar.
    tituloEn: NIVELES_CON_TITULO.includes(data.nivelEducativo as Nivel) ? normalizar(data.tituloEn ?? '') || null : null,
    posgrado: data.posgrado,
    posgradoEn: data.posgrado ? normalizar(data.posgradoEn ?? '') || null : null,
    certificaciones: data.certificaciones,
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
