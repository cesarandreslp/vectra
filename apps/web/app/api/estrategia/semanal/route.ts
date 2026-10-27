import { NextResponse } from 'next/server'
import { getTenantDb, superadminDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { correrAgente } from '@/lib/estrategia/agente'

// Claude con razonamiento alto tarda; 300 s es el máximo de la función.
export const maxDuration = 300

/**
 * GET /api/estrategia/semanal
 * Corre el agente semanal de estrategia en cada tenant activo con ANALYTICS.
 * Lo llama cron-job.org los lunes a las 6 a. m. (hora Colombia) con el header
 * Authorization: Bearer <CRON_SECRET>. Repetir la llamada no duplica: cada
 * tenant corre una vez por semana (las corridas con ERROR se reintentan).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (process.env.NODE_ENV === 'production' && (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ponytail: tenants en serie dentro de una función de 300 s; con más de ~3 tenants, una llamada por tenant (?tenant=slug).
  const tenants = await superadminDb.tenant.findMany({
    where:  { isActive: true, modules: { some: { moduleKey: 'ANALYTICS', isActive: true } } },
    select: { id: true, slug: true },
  })

  const resultados: Record<string, string> = {}
  for (const t of tenants) {
    try {
      const r = await correrAgente(getTenantDb(await getTenantConnection(t.id)), t.id)
      resultados[t.slug] = r.estado === 'ok' ? `ok: ${r.aplicados} aplicados, ${r.rechazados} rechazados` : r.estado === 'error' ? `error: ${r.error}` : r.estado
    } catch (err) {
      console.error(`[AGENTE ESTRATEGIA] tenant ${t.slug}:`, err)
      resultados[t.slug] = 'error'
    }
  }

  return NextResponse.json({ status: 'ok', resultados })
}
