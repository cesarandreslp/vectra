/**
 * Consultas del plan contra realidad y de los contactos de calle, sin sesión:
 * las usan las Server Actions de /core/estructura (después de verificar rol)
 * y el agente semanal de estrategia (que corre desde el cron).
 * Todo se cuenta en la base y no sale PII: solo conteos y nombres de líderes.
 */

import { superadminDb, type getTenantDb } from '@vectra/db'
import { compromisosParaMeta } from '@/lib/meta-votos'
import { resumenContactos, type ResumenContactos } from '@/lib/contacto-calle'
import {
  calcularCascada, esperadoHoy, factoresDe, type FactoresCascada, type Niveles,
} from '@/app/(tenant)/core/estructura/_lib/cascada'

type TenantDb = ReturnType<typeof getTenantDb>

export interface LiderPlan {
  id:              string
  nombre:          string
  multiplicadores: number
  compromisos:     number // de su subárbol, él incluido
  nuevos7d:        number // compromisos de su subárbol registrados en los últimos 7 días
  targetVotes:     number // meta propia en votos (0 = sin meta)
  esperado:        number // compromisos: los que pide su targetVotes (con fuga) o, sin meta propia, multiplicadoresPorLider × compromisosPorMultiplicador
}

export interface PlanView {
  metaVotos:  number | null
  factores:   FactoresCascada & { nivelLider: number }
  necesario:  Niveles | null // null sin meta configurada
  real:       Niveles
  lideres:    LiderPlan[] // ordenados por mayor faltante
  hitos:      number      // cuántos hay definidos
  proximo:    (Niveles & { fecha: Date; nota: string | null }) | null
  esperado:   Niveles | null // a hoy, interpolado entre hitos; null sin hitos
  /** Reparto de la meta global en las comunas (Territorio): debería sumar metaVotos. */
  metasComunas: { suma: number; conMeta: number; total: number }
}

interface FilaLider { id: string; nombre: string; targetVotes: number; multiplicadores: bigint; compromisos: bigint; nuevos7d: bigint }


export async function planEstructura(db: TenantDb, tenantId: string): Promise<PlanView> {
  const [cfg, hitos, tenant, sumaComunas, comunas, comunasConMeta] = await Promise.all([
    db.tenantConfig.findUnique({ where: { tenantId } }),
    db.hitoEstructura.findMany({ where: { tenantId }, orderBy: { fecha: 'asc' } }),
    superadminDb.tenant.findUnique({ where: { id: tenantId }, select: { createdAt: true } }),
    db.commune.aggregate({ _sum: { metaVotos: true } }),
    db.commune.count(),
    db.commune.count({ where: { metaVotos: { not: null } } }),
  ])
  const factores = { ...factoresDe(cfg), nivelLider: cfg?.nivelLider ?? 1 }
  const n = factores.nivelLider

  // Profundidad desde el candidato (0). Las raíces que no son el candidato
  // cuelgan de él implícitamente (profundidad 1), así la red cuenta igual
  // aunque no haya candidato marcado. `lider` se fija al pasar por el nivel n
  // y se hereda hacia abajo. Tope de 30 niveles por si el árbol trae un ciclo.
  const [contactos, compromisos, filas] = await Promise.all([
    db.voter.count({ where: { tenantId, isCandidate: false } }),
    db.voter.count({ where: { tenantId, isCandidate: false, commitmentStatus: { in: ['COMPROMETIDO', 'VOTO_SEGURO'] } } }),
    db.$queryRaw<FilaLider[]>`
      WITH RECURSIVE arbol AS (
        SELECT id, 0 AS depth, CASE WHEN ${n}::int = 0 THEN id END AS lider
          FROM "Voter" WHERE "tenantId" = ${tenantId} AND "isCandidate"
        UNION ALL
        SELECT id, 1, CASE WHEN ${n}::int = 1 THEN id END
          FROM "Voter" WHERE "tenantId" = ${tenantId} AND "leaderId" IS NULL AND NOT "isCandidate"
        UNION ALL
        SELECT v.id, a.depth + 1, CASE WHEN a.depth + 1 = ${n}::int THEN v.id ELSE a.lider END
          FROM "Voter" v JOIN arbol a ON v."leaderId" = a.id
         WHERE a.depth < 30
      )
      SELECT l.id, l.name AS nombre, l."targetVotes",
             count(*) FILTER (WHERE a.depth = ${n}::int + 1
               AND EXISTS (SELECT 1 FROM "Voter" f WHERE f."leaderId" = a.id)) AS multiplicadores,
             count(*) FILTER (WHERE x."commitmentStatus" IN ('COMPROMETIDO', 'VOTO_SEGURO')) AS compromisos,
             count(*) FILTER (WHERE x."commitmentStatus" IN ('COMPROMETIDO', 'VOTO_SEGURO')
               AND x."createdAt" >= now() - interval '7 days') AS "nuevos7d"
        FROM arbol a
        JOIN "Voter" x ON x.id = a.id
        JOIN "Voter" l ON l.id = a.lider
       GROUP BY l.id, l.name, l."targetVotes"
      HAVING count(*) > 1`, // >1 nodo en el subárbol = tiene al menos un follower
  ])

  const porDefecto = factores.multiplicadoresPorLider * factores.compromisosPorMultiplicador
  const lideres = filas
    .map((f) => ({
      id:              f.id,
      nombre:          f.nombre,
      multiplicadores: Number(f.multiplicadores),
      compromisos:     Number(f.compromisos),
      nuevos7d:        Number(f.nuevos7d),
      targetVotes:     f.targetVotes,
      esperado:        f.targetVotes > 0 ? compromisosParaMeta(f.targetVotes, factores.tasaFuga) : porDefecto,
    }))
    .sort((a, b) => (b.esperado - b.compromisos) - (a.esperado - a.compromisos))

  return {
    metaVotos: cfg?.metaVotos ?? null,
    factores,
    necesario: cfg?.metaVotos ? calcularCascada(cfg.metaVotos, factores) : null,
    real: {
      contactos, compromisos,
      lideres:         lideres.length,
      multiplicadores: lideres.reduce((s, l) => s + l.multiplicadores, 0),
    },
    lideres,
    hitos: hitos.length,
    // Antes del primer hito se arranca de cero en la fecha de alta del tenant.
    ...esperadoHoy(hitos, tenant?.createdAt ?? new Date(), new Date()),
    metasComunas: { suma: sumaComunas._sum.metaVotos ?? 0, conMeta: comunasConMeta, total: comunas },
  }
}

export interface ContactosCalleView {
  resumen:    ResumenContactos
  porComuna:  { comuna: string; fichas: number; convertidos: number }[]
  rezagados:  { id: string; nombre: string; dias: number; comuna: string | null; lider: string | null }[]
}

const DIA = 86_400_000

export async function contactosCalle(db: TenantDb, tenantId: string): Promise<ContactosCalleView> {
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
