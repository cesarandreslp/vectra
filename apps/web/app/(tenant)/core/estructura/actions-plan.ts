'use server'

/**
 * Plan contra realidad: lo que la meta de votos exige en cada nivel de la red
 * frente a lo que hay en el árbol Voter (leaderId/followers). Todo se cuenta en
 * la base — el padrón nunca se carga en memoria — y no sale PII: solo conteos
 * y nombres de líderes.
 */

import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantDb, superadminDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { calcularCascada, esperadoHoy, type FactoresCascada, type Niveles } from './_lib/cascada'

export interface LiderPlan {
  id:              string
  nombre:          string
  multiplicadores: number
  compromisos:     number // de su subárbol, él incluido
  esperado:        number // targetVotes si lo tiene; si no, multiplicadoresPorLider × compromisosPorMultiplicador
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
}

interface FilaLider { id: string; nombre: string; targetVotes: number; multiplicadores: bigint; compromisos: bigint }

export async function getPlanEstructura(): Promise<PlanView> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_ESTRUCTURA')
  const tenantId = session.user.tenantId
  const db       = getTenantDb(await getTenantConnection(tenantId))

  const [cfg, hitos, tenant] = await Promise.all([
    db.tenantConfig.findUnique({ where: { tenantId } }),
    db.hitoEstructura.findMany({ where: { tenantId }, orderBy: { fecha: 'asc' } }),
    superadminDb.tenant.findUnique({ where: { id: tenantId }, select: { createdAt: true } }),
  ])
  const factores = {
    tasaFuga:                    cfg?.tasaFuga ?? 0.2,
    tasaConversion:              cfg?.tasaConversion ?? 0.4,
    compromisosPorMultiplicador: cfg?.compromisosPorMultiplicador ?? 12,
    multiplicadoresPorLider:     cfg?.multiplicadoresPorLider ?? 10,
    nivelLider:                  cfg?.nivelLider ?? 1,
  }
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
             count(*) FILTER (WHERE x."commitmentStatus" IN ('COMPROMETIDO', 'VOTO_SEGURO')) AS compromisos
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
      esperado:        f.targetVotes > 0 ? f.targetVotes : porDefecto,
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
  }
}
