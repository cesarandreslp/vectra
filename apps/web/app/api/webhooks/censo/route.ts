import { NextResponse } from 'next/server'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { aplicarJob, firmaValida } from '@/lib/censo'

/**
 * POST /api/webhooks/censo?t=<tenantId> — resultado de una consulta asíncrona.
 *
 * La firma (HMAC con CENSO_WEBHOOK_SECRET) es lo único que autentica: sin ella
 * cualquiera podría escribir lugares de votación falsos. El tenantId viaja en la
 * URL que armamos al encolar; aplicarJob solo toca electores de ese tenant con
 * ese job_id, así que cambiarlo no sirve para nada.
 *
 * Hay que responder 2xx rápido; un 5xx hace que la API reintente (hasta 5).
 */
export async function POST(request: Request) {
  const secreto = process.env.CENSO_WEBHOOK_SECRET
  const cuerpo  = await request.text()
  const h       = request.headers

  if (!secreto || !firmaValida(secreto, h.get('x-webhook-timestamp') ?? '', cuerpo, h.get('x-webhook-signature') ?? '')) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  const tenantId = new URL(request.url).searchParams.get('t')
  const jobId    = h.get('x-webhook-id')
  if (!tenantId || !jobId) return NextResponse.json({ error: 'Faltan t o X-Webhook-Id' }, { status: 400 })

  try {
    const db = getTenantDb(await getTenantConnection(tenantId))
    await aplicarJob(db, tenantId, jobId, JSON.parse(cuerpo))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook censo]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'No se pudo aplicar' }, { status: 500 })
  }
}
