import { NextResponse } from 'next/server'
import { getTenantDb, superadminDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { enviarPendientesTenant } from '@/lib/encuestas/enviar-pendientes'
import { formatInTimeZone } from 'date-fns-tz'

const TIMEZONE = 'America/Bogota'

/**
 * Verifica si la hora actual en Bogotá está dentro del horario permitido:
 * 5:00 AM – 8:00 PM
 */
function isWithinAllowedHours(): boolean {
  const now = new Date()
  const timeStr = formatInTimeZone(now, TIMEZONE, 'HH:mm')
  const [hours, minutes] = timeStr.split(':').map(Number)
  const timeInMinutes = hours * 60 + minutes

  const start = 5 * 60 // 5:00 AM
  const end = 20 * 60  // 8:00 PM

  return timeInMinutes >= start && timeInMinutes <= end
}

/**
 * GET /api/encuestas/cron
 * Endpoint protegido para ejecutar el envío automático de mensajes de encuestas a
 * electores pendientes en todos los tenants activos.
 *
 * No hay ninguna entrada "crons" en vercel.json — Vercel no llama esto solo.
 * Hace falta apuntarle un cron externo (Vercel Cron o cron-job.org) a esta URL
 * con el header Authorization: Bearer <CRON_SECRET>. Mientras tanto, el botón
 * "Enviar ahora" en /encuestas/campanas cubre el envío bajo demanda.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')

  // En producción, Vercel envía el CRON_SECRET en el header de autorización.
  // cron-job.org puede enviar un token estático en el header o params.
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    request.url.indexOf(`token=${process.env.CRON_SECRET}`) === -1
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isWithinAllowedHours()) {
    console.log('[CRON ENCUESTAS] Fuera de horario permitido. Skipped.')
    return NextResponse.json({ status: 'skipped', reason: 'outside_allowed_hours' })
  }

  let totalProcessed = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resultsByTenant: Record<string, any> = {}

  try {
    const tenants = await superadminDb.tenant.findMany({ where: { isActive: true } })

    for (const tenant of tenants) {
      try {
        const connStr  = await getTenantConnection(tenant.id)
        const tenantDb = getTenantDb(connStr)

        const resultado = await enviarPendientesTenant(tenant.id, tenantDb)
        resultsByTenant[tenant.id] = resultado
        totalProcessed += resultado.count ?? 0
      } catch (e) {
        console.error(`[CRON ENCUESTAS] Error procesando tenant ${tenant.id}:`, e)
        resultsByTenant[tenant.id] = { status: 'error', error: (e as Error).message }
      }
    }

    return NextResponse.json({
      status: 'success',
      totalProcessed,
      resultsByTenant,
    })

  } catch (error) {
    console.error('[CRON ENCUESTAS] Error global:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
