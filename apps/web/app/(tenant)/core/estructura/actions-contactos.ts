'use server'

/**
 * Tablero de contactos de calle del candidato: cuántos saluda, cuántos dan
 * datos, cuántos se vuelven electores y cuáles se están quedando sin
 * seguimiento. Sin celulares: conteos y nombres.
 */

import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { resumenContactos, type ResumenContactos } from '@/lib/contacto-calle'

export interface ContactosCalleView {
  resumen:    ResumenContactos
  porComuna:  { comuna: string; fichas: number; convertidos: number }[]
  rezagados:  { id: string; nombre: string; dias: number; comuna: string | null; lider: string | null }[]
}

const DIA = 86_400_000

export async function getContactosCalle(): Promise<ContactosCalleView> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_ESTRUCTURA')
  const tenantId = session.user.tenantId
  const db       = getTenantDb(await getTenantConnection(tenantId))
  const ahora    = new Date()

  // ponytail: trae fecha/nombre/estado de todos los contactos (columnas chicas); pasar a groupBy si crecen a cientos de miles.
  const [filas, porComuna, rezagados, comunas] = await Promise.all([
    db.contactoCalle.findMany({ where: { tenantId }, select: { fecha: true, nombre: true, estado: true } }),
    db.contactoCalle.groupBy({
      by: ['communeId', 'estado'], where: { tenantId, nombre: { not: null } }, _count: { _all: true },
    }),
    db.contactoCalle.findMany({
      where:   { tenantId, nombre: { not: null }, estado: 'PENDIENTE', fecha: { lt: new Date(ahora.getTime() - 3 * DIA) } },
      select:  { id: true, nombre: true, fecha: true, communeId: true, asignadoAId: true },
      orderBy: { fecha: 'asc' },
      take:    20,
    }),
    db.commune.findMany({ select: { id: true, name: true } }),
  ])

  const nombreComuna = new Map(comunas.map((c) => [c.id, c.name]))
  const lideres = new Map((await db.voter.findMany({
    where:  { id: { in: rezagados.flatMap((r) => r.asignadoAId ?? []) } },
    select: { id: true, name: true },
  })).map((v) => [v.id, v.name]))

  const zonas = new Map<string, { comuna: string; fichas: number; convertidos: number }>()
  for (const g of porComuna) {
    const comuna = g.communeId ? nombreComuna.get(g.communeId) ?? 'Sin zona' : 'Sin zona'
    const z = zonas.get(comuna) ?? { comuna, fichas: 0, convertidos: 0 }
    z.fichas += g._count._all
    if (g.estado === 'CONVERTIDO') z.convertidos += g._count._all
    zonas.set(comuna, z)
  }

  return {
    resumen:   resumenContactos(filas, ahora),
    porComuna: [...zonas.values()].sort((a, b) => b.fichas - a.fichas),
    rezagados: rezagados.map((r) => ({
      id: r.id, nombre: r.nombre!, dias: Math.floor((ahora.getTime() - r.fecha.getTime()) / DIA),
      comuna: r.communeId ? nombreComuna.get(r.communeId) ?? null : null,
      lider:  r.asignadoAId ? lideres.get(r.asignadoAId) ?? null : null,
    })),
  }
}
