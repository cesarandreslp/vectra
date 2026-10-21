import { NextResponse } from 'next/server'
import { getTenantDb, superadminDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { responsablesAgenda } from '@/lib/agenda'
import { enviarPushAVoters } from '@/lib/push'
import { textoColombia } from '@/lib/hora-colombia'

const VENTANA_MIN = 30

/**
 * GET /api/agenda/recordatorios
 * Push de "empieza en 30 min" para compromisos y citas reservadas: al anfitrión,
 * a su gestor y al elector que reservó. Cada entrada se avisa una sola vez
 * (recordatorioEnviado; se resetea si le cambian la hora).
 *
 * Vercel Hobby solo permite crons diarios: esto lo llama un cron externo
 * (cron-job.org) cada 5 min con el header Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (process.env.NODE_ENV === 'production' && (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ahora  = new Date()
  const limite = new Date(ahora.getTime() + VENTANA_MIN * 60_000)
  const enviados: Record<string, number> = {}

  const tenants = await superadminDb.tenant.findMany({ where: { isActive: true }, select: { id: true, slug: true } })
  for (const t of tenants) {
    try {
      const db = getTenantDb(await getTenantConnection(t.id))
      const proximas = await db.agendaEntrada.findMany({
        where: {
          tenantId: t.id, recordatorioEnviado: false, estado: null,
          startsAt: { gt: ahora, lte: limite },
          OR: [{ disponible: false }, { reservadoPor: { not: null } }],
        },
        include: { anfitrion: { select: { id: true, name: true, isCandidate: true } }, reservante: { select: { name: true } } },
      })

      enviados[t.slug] = 0
      for (const e of proximas) {
        // Se marca antes de enviar: si dos corridas se pisan, solo una gana.
        const tomada = await db.agendaEntrada.updateMany({ where: { id: e.id, recordatorioEnviado: false }, data: { recordatorioEnviado: true } })
        if (tomada.count === 0) continue

        const min = Math.round((e.startsAt.getTime() - ahora.getTime()) / 60_000)
        const que = e.disponible ? `Cita con ${e.reservante?.name ?? 'un elector'}` : e.titulo
        await enviarPushAVoters(db, t.id, await responsablesAgenda(db, t.id, e.anfitrion), {
          title: `En ${min} min: ${que}`,
          body:  `${textoColombia(e.startsAt)} · agenda de ${e.anfitrion.name}`,
          url:   '/pwa/agenda',
        })
        await enviarPushAVoters(db, t.id, [e.reservadoPor], {
          title: `Tu cita empieza en ${min} min`,
          body:  `Con ${e.anfitrion.name}, ${textoColombia(e.startsAt)}.`,
          url:   '/pwa/agenda',
        })
        enviados[t.slug]++
      }
    } catch (err) {
      console.error(`[RECORDATORIOS AGENDA] tenant ${t.slug}:`, err)
    }
  }

  return NextResponse.json({ status: 'ok', enviados })
}
