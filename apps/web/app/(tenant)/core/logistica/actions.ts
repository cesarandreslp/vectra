'use server'

import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { inferirTipoComida, labelTipoComida, type TipoComida } from '@/lib/logistica'

const ROLES_ADMIN = ['ADMIN_CAMPANA', 'COORDINADOR'] as const

export interface ConvocatoriaLogistica {
  id: string
  titulo: string
  startsAt: string
  direccion: string | null
  lugar: string | null
  totalDestinatarios: number
  tipoComida: TipoComida
  tipoComidaLabel: string
}

export interface ReclutamientoLogistica {
  id: string
  titulo: string
  date: string
  organizadorName: string
  totalProspectos: number
  tipoComida: TipoComida
  tipoComidaLabel: string
}

export interface LogisticaDia {
  convocatorias: ConvocatoriaLogistica[]
  reclutamiento: ReclutamientoLogistica[]
  totalesPorComida: Record<TipoComida, number>
}

function rangoDelDia(fecha: string): { desde: Date; hasta: Date } {
  const desde = new Date(`${fecha}T00:00:00`)
  const hasta = new Date(`${fecha}T23:59:59.999`)
  return { desde, hasta }
}

/** Reuniones del día — convocadas por el equipo (Convocatoria) o por electores reclutando (Meeting). */
export async function getLogisticaDia(fecha: string): Promise<LogisticaDia> {
  const session = await requireModuleOrScreen('CORE', [...ROLES_ADMIN], 'CORE_LOGISTICA')
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))
  const { desde, hasta } = rangoDelDia(fecha)

  const [convocatoriasRaw, reunionesRaw] = await Promise.all([
    db.convocatoria.findMany({
      where: { tenantId: session.user.tenantId, startsAt: { gte: desde, lte: hasta } },
      include: { _count: { select: { destinatarios: true } } },
      orderBy: { startsAt: 'asc' },
    }),
    db.meeting.findMany({
      where: { tenantId: session.user.tenantId, tipo: 'RECLUTAMIENTO', date: { gte: desde, lte: hasta } },
      include: { prospectos: true },
      orderBy: { date: 'asc' },
    }),
  ])

  const organizadores = await db.voter.findMany({
    where: { id: { in: [...new Set(reunionesRaw.map((r) => r.leaderId))] } },
    select: { id: true, name: true },
  })
  const nombrePorId = new Map(organizadores.map((v) => [v.id, v.name]))

  const totalesPorComida: Record<TipoComida, number> = { DESAYUNO: 0, ALMUERZO: 0, CENA: 0, REFRIGERIO: 0 }

  const convocatorias: ConvocatoriaLogistica[] = convocatoriasRaw.map((c) => {
    const tipoComida = inferirTipoComida(c.startsAt)
    totalesPorComida[tipoComida] += c._count.destinatarios
    return {
      id: c.id, titulo: c.titulo, startsAt: c.startsAt.toISOString(),
      direccion: c.direccion, lugar: c.lugar, totalDestinatarios: c._count.destinatarios,
      tipoComida, tipoComidaLabel: labelTipoComida(tipoComida),
    }
  })

  const reclutamiento: ReclutamientoLogistica[] = reunionesRaw.map((r) => {
    const tipoComida = inferirTipoComida(r.date)
    totalesPorComida[tipoComida] += r.prospectos.length
    return {
      id: r.id, titulo: r.title, date: r.date.toISOString(),
      organizadorName: nombrePorId.get(r.leaderId) ?? '(desconocido)',
      totalProspectos: r.prospectos.length,
      tipoComida, tipoComidaLabel: labelTipoComida(tipoComida),
    }
  })

  return { convocatorias, reclutamiento, totalesPorComida }
}
