/**
 * Lo que el agente semanal ve de la campaña. Sin PII: las personas viajan con
 * alias (L1, L2…), los contactos de calle como K1… sin nombre ni nota, y el
 * mapa alias → id se queda en el servidor. Las comunas sí van con su nombre
 * (es geografía, no datos personales).
 */

import type { getTenantDb } from '@vectra/db'
import { planEstructura, contactosCalle } from './datos'
import type { Contexto } from './correctivos'

type TenantDb = ReturnType<typeof getTenantDb>

const DIA = 86_400_000
const DIAS_ESTANCADO = 14

export interface Alias { id: string; nombre: string }

export interface Snapshot {
  datos:   Record<string, unknown> // lo que se manda al modelo
  ctx:     Contexto                // para validar sus propuestas
  alias:   Record<string, Alias>   // alias → id real (L#, C#, K#)
}

export async function armarSnapshot(db: TenantDb, tenantId: string, ahora = new Date()): Promise<Snapshot> {
  const [plan, calle, candidato, comunas, barrios, compromisosComuna, cargos, prospectos, estancados, pendientes] = await Promise.all([
    planEstructura(db, tenantId),
    contactosCalle(db, tenantId),
    db.voter.findFirst({ where: { tenantId, isCandidate: true }, select: { id: true, name: true } }),
    db.commune.findMany({ select: { id: true, name: true, metaVotos: true, lider: { select: { id: true, name: true } } }, orderBy: { name: 'asc' } }),
    db.neighborhood.findMany({ where: { liderId: { not: null } }, select: { communeId: true, lider: { select: { id: true, name: true } } } }),
    db.$queryRaw<{ id: string; n: bigint }[]>`
      SELECT nb."communeId" AS id, count(*) AS n
        FROM "Voter" v JOIN "Neighborhood" nb ON nb.id = v."neighborhoodId"
       WHERE v."tenantId" = ${tenantId} AND v."commitmentStatus" IN ('COMPROMETIDO', 'VOTO_SEGURO')
       GROUP BY nb."communeId"`,
    db.cargoAsignacion.groupBy({ by: ['cargo', 'estado'], where: { tenantId }, _count: { _all: true } }),
    db.prospectoLider.groupBy({ by: ['etapa'], where: { tenantId }, _count: { _all: true } }),
    db.prospectoLider.count({
      where: {
        tenantId,
        OR: [
          { etapa: 'CANDIDATO', createdAt: { lt: new Date(ahora.getTime() - DIAS_ESTANCADO * DIA) } },
          { etapa: 'CONVERSADO', conversadoEn: { lt: new Date(ahora.getTime() - DIAS_ESTANCADO * DIA) } },
        ],
      },
    }),
    db.contactoCalle.findMany({
      where:   { tenantId, nombre: { not: null }, estado: 'PENDIENTE', fecha: { lt: new Date(ahora.getTime() - 5 * DIA) } },
      select:  { id: true, fecha: true, communeId: true, asignadoAId: true, temperatura: true },
      orderBy: { fecha: 'asc' },
      take:    40,
    }),
  ])

  const alias: Record<string, Alias> = {}
  const porId = new Map<string, string>()
  let nL = 0
  const persona = (p: { id: string; name: string }): string => {
    const ya = porId.get(p.id)
    if (ya) return ya
    const a = `L${++nL}`
    porId.set(p.id, a)
    alias[a] = { id: p.id, nombre: p.name }
    return a
  }

  // Líderes del plan: los únicos con meta movible.
  const lideres = plan.lideres.map((l) => ({
    alias:           persona({ id: l.id, name: l.nombre }),
    metaVotos:       l.targetVotes,
    compromisos:     l.compromisos,
    esperado:        l.esperado,
    nuevos7d:        l.nuevos7d,
    multiplicadores: l.multiplicadores,
  }))
  const candidatoAlias = candidato ? persona(candidato) : null

  const compPorComuna = new Map(compromisosComuna.map((c) => [c.id, Number(c.n)]))
  const comunaAlias = new Map<string, string>()
  const comunasDatos = comunas.map((c, i) => {
    const a = `C${i + 1}`
    comunaAlias.set(c.id, a)
    alias[a] = { id: c.id, nombre: c.name }
    return {
      alias: a, nombre: c.name, metaVotos: c.metaVotos, compromisos: compPorComuna.get(c.id) ?? 0,
      coordinador: c.lider ? persona(c.lider) : null,
      lideresDeBarrio: [...new Set(barrios.filter((b) => b.communeId === c.id && b.lider).map((b) => persona(b.lider!)))],
    }
  })
  const personas = new Set(Object.keys(alias).filter((a) => a.startsWith('L') && a !== candidatoAlias))

  // Contactos de calle sin seguimiento: K# sin nombre ni nota.
  const asignados = pendientes.flatMap((p) => p.asignadoAId ?? [])
  const nombresAsignados = new Map((await db.voter.findMany({ where: { id: { in: asignados } }, select: { id: true, name: true } })).map((v) => [v.id, v.name]))
  const contactos = pendientes.map((p, i) => {
    const a = `K${i + 1}`
    alias[a] = { id: p.id, nombre: a }
    const nombreAsignado = p.asignadoAId ? nombresAsignados.get(p.asignadoAId) : undefined
    return {
      alias: a, dias: Math.floor((ahora.getTime() - p.fecha.getTime()) / DIA), temperatura: p.temperatura,
      comuna:   p.communeId ? comunaAlias.get(p.communeId) ?? null : null,
      asignado: p.asignadoAId && nombreAsignado ? persona({ id: p.asignadoAId, name: nombreAsignado }) : null,
    }
  })

  const ctx: Contexto = {
    metaGlobal: plan.metaVotos,
    lideres:    new Map(lideres.map((l) => [l.alias, { targetVotes: l.metaVotos }])),
    personas,
    candidato:  candidatoAlias,
    comunas:    new Map(comunasDatos.map((c) => [c.alias, { metaVotos: c.metaVotos }])),
    contactos:  new Map(contactos.map((c) => [c.alias, { dias: c.dias, asignado: c.asignado }])),
  }

  const datos = {
    fecha:      ahora.toISOString().slice(0, 10),
    metaVotos:  plan.metaVotos,
    factores:   plan.factores,
    necesario:  plan.necesario,
    real:       plan.real,
    esperadoHoy: plan.esperado,
    proximoHito: plan.proximo,
    candidato:  candidatoAlias,
    lideres,
    comunas:    comunasDatos,
    sumaMetasComunas: plan.metasComunas.suma,
    cargos:     cargos.map((c) => ({ cargo: c.cargo, estado: c.estado, n: c._count._all })),
    prospectos: { porEtapa: Object.fromEntries(prospectos.map((p) => [p.etapa, p._count._all])), estancados14d: estancados },
    contactosCalle: { resumen: calle.resumen, porZona: calle.porComuna, sinSeguimiento: contactos },
  }

  return { datos, ctx, alias }
}
