'use server'

/** Ley 1581: el texto de autorización que ve quien se registra y el contacto para ejercer sus derechos. */

import { revalidatePath } from 'next/cache'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { requireAuth } from '@/lib/auth-helpers'
import { textoSugerido } from '@/lib/autorizacion-datos'
import { politicaSugerida } from '@/lib/politica-datos'

export interface ConfigDatos {
  texto:     string        // el que escribió la campaña ('' = usa el sugerido)
  contacto:  string
  sugerido:  string        // el texto sugerido con el nombre y contacto de la campaña
  politica:  string        // política propia ('' = la sugerida)
  politicaSugerida: string
  urlPublica: string       // /privacidad?c=slug
  sinAutorizacion: number  // electores sin autorización registrada
}

async function sesionYDb() {
  const session = await requireAuth(['ADMIN_CAMPANA'])
  return { session, tenantId: session.user.tenantId, db: getTenantDb(await getTenantConnection(session.user.tenantId)) }
}

export async function getConfigDatos(): Promise<ConfigDatos> {
  const { session, tenantId, db } = await sesionYDb()
  const [c, sinAutorizacion] = await Promise.all([
    db.tenantConfig.findUnique({ where: { tenantId }, select: { autorizacionTexto: true, autorizacionContacto: true, politicaTratamiento: true } }),
    db.voter.count({ where: { tenantId, autorizacionDatosEn: null } }),
  ])
  return {
    texto:    c?.autorizacionTexto ?? '',
    contacto: c?.autorizacionContacto ?? '',
    sugerido: textoSugerido(session.user.tenantName ?? 'la campaña', c?.autorizacionContacto ?? null),
    politica: c?.politicaTratamiento ?? '',
    politicaSugerida: politicaSugerida(session.user.tenantName ?? 'la campaña', c?.autorizacionContacto ?? null),
    urlPublica: `/privacidad?c=${encodeURIComponent(session.user.tenantSlug ?? '')}`,
    sinAutorizacion,
  }
}

export async function guardarConfigDatos(texto: string, contacto: string, politica: string): Promise<{ success: true } | { success: false; error: string }> {
  const { tenantId, db } = await sesionYDb()
  const t = typeof texto === 'string' ? texto.trim() : ''
  const k = typeof contacto === 'string' ? contacto.trim() : ''
  const p = typeof politica === 'string' ? politica.trim() : ''
  if (t.length > 3000) return { success: false, error: 'El texto pasa de 3000 caracteres.' }
  if (k.length > 200) return { success: false, error: 'El contacto pasa de 200 caracteres.' }
  if (p.length > 20000) return { success: false, error: 'La política pasa de 20000 caracteres.' }
  const datos = { autorizacionTexto: t || null, autorizacionContacto: k || null, politicaTratamiento: p || null }
  await db.tenantConfig.upsert({ where: { tenantId }, create: { tenantId, ...datos }, update: datos })
  revalidatePath('/core/configuracion')
  return { success: true }
}
