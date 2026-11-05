'use server'

/**
 * Ley 1581 para quien ya está en el padrón sin autorización registrada (los
 * importados, los creados a mano sin declararla, los de antes de existir esto):
 * la da al entrar a la app.
 */

import { headers } from 'next/headers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { requireAuth } from '@/lib/auth-helpers'
import { textoAutorizacion, registrarAutorizacion } from '@/lib/autorizacion-datos'

async function sesionYDb() {
  const session = await requireAuth(['ELECTOR', 'LIDER', 'ADMIN_CAMPANA', 'COORDINADOR', 'TESTIGO'])
  return { session, db: getTenantDb(await getTenantConnection(session.user.tenantId)) }
}

/** El texto que tiene que aceptar, o null si ya autorizó (o la cuenta no tiene elector). */
export async function getAutorizacionPendiente(): Promise<{ texto: string; politica: string } | null> {
  const { session, db } = await sesionYDb()
  if (!session.user.voterId) return null
  const v = await db.voter.findFirst({
    where:  { id: session.user.voterId, tenantId: session.user.tenantId },
    select: { autorizacionDatosEn: true },
  })
  if (!v || v.autorizacionDatosEn) return null
  return {
    texto:    await textoAutorizacion(db, session.user.tenantId, session.user.tenantName ?? 'la campaña'),
    politica: `/privacidad?c=${encodeURIComponent(session.user.tenantSlug ?? '')}`,
  }
}

export async function aceptarAutorizacion(): Promise<{ success: boolean }> {
  const { session, db } = await sesionYDb()
  if (!session.user.voterId) return { success: false }
  const h = await headers()
  await registrarAutorizacion(db, {
    tenantId: session.user.tenantId, voterIds: [session.user.voterId], canal: 'PWA',
    // Se guarda el texto vigente al aceptar, leído del servidor.
    texto: await textoAutorizacion(db, session.user.tenantId, session.user.tenantName ?? 'la campaña'),
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
  })
  return { success: true }
}
