import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getTenantConnection } from '@/lib/tenant'
import { agenteActivo, atender } from '@/lib/agente/motor'
import { autorizado, leerCorreo, claveCorreo, asuntoRespuesta, textoAHtml } from '@/lib/correo-entrada'
import { cargarSmtp, direccionesDe } from '@/lib/smtp'
import { getTenantDb, superadminDb } from '@vectra/db'
import { sendMessage } from '@vectra/messaging'

/**
 * Correo de entrada de una campaña (Postmark Inbound): /api/webhooks/correo?c=<slug>.
 * Postmark llama con usuario y clave en la URL (autenticación básica); la clave
 * la genera Vectra al conectar el correo en Comunicaciones → Agente IA.
 * Responde 200 a todo lo autenticado, para que Postmark no reintente.
 */
export async function POST(request: Request) {
  const slug = new URL(request.url).searchParams.get('c')
  const tenant = slug ? await superadminDb.tenant.findUnique({ where: { slug }, select: { id: true, isActive: true } }) : null
  if (!tenant?.isActive) return new NextResponse('Forbidden', { status: 403 })

  const db = getTenantDb(await getTenantConnection(tenant.id))
  const config = await db.tenantConfig.findUnique({ where: { tenantId: tenant.id }, select: { correoEntradaSecreto: true } })
  if (!config?.correoEntradaSecreto || !autorizado(request.headers.get('authorization'), config.correoEntradaSecreto)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const smtp = await cargarSmtp(db, tenant.id)
  const correo = leerCorreo(await request.json().catch(() => null), direccionesDe(smtp))
  if (!correo || !smtp || !(await agenteActivo(db, tenant.id))) return NextResponse.json({ ok: true })

  const asunto = asuntoRespuesta(correo.asunto)
  waitUntil(
    atender({
      tenantId: tenant.id, db, canal: 'EMAIL', clave: claveCorreo(correo.de), destino: correo.de, telefono: null,
      texto: correo.texto, providerMsgId: correo.messageId ? `mail-in:${correo.messageId}` : undefined,
      enviar: async (texto) => {
        const r = await sendMessage({ to: correo.de, channel: 'EMAIL', subject: asunto, body: textoAHtml(texto) }, smtp)
        if (!r.success) console.error('[CORREO] Respuesta no enviada:', r.error)
        return { ok: r.success, providerMsgId: r.providerMsgId }
      },
    }).catch((err) => console.error('[CORREO] Error atendiendo:', err)),
  )
  return NextResponse.json({ ok: true })
}
