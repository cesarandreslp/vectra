'use server'

/**
 * Server Actions del módulo ANALYTICS.
 * Todas las acciones:
 *   - Verifican autenticación, rol y módulo con requireModule('ANALYTICS')
 *   - Obtienen la DB del tenant via getTenantConnection()
 *   - Nunca retornan cédula ni connectionString al cliente
 */

import { requireModule, requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb }         from '@vectra/db'
import { chatZhipu }           from '@vectra/ai'
import { getTenantAiKeys }     from '@/lib/tenant-ai'
import { idsLideres }          from '@/app/(tenant)/core/actions'
import { revalidatePath }      from 'next/cache'

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface DashboardKpi {
  totalRegistrados:  number
  comprometidos:     number
  votoSeguro:        number
  sinContactar:      number
  totalLideres:      number
  lideresActivos:    number
  lideresInactivos:  number
  promedioElectoresPorLider: number
  pctAvance:         number | null  // null si no hay metaVotos configurada
  diasRestantes:     number | null  // null si no hay fechaEleccion configurada
  registrosHoy:      number
  registrosSemana:   number
  serieTemporal:     { dia: string; total: number }[]
  distribucion:      { estado: string; cantidad: number }[]
}

export interface TerritoryRow {
  municipio:    string
  divipola:     string
  registrados:  number
  comprometidos: number
  pctAvance:    number
  meta:         number
  brecha:       number
  lideresActivos: number
}

export interface LeaderAnalyticsRow {
  id:               string
  nombre:           string
  zona:             string | null
  electoresAsignados: number
  comprometidos:    number
  pctAvance:        number
  ultimaActividad:  string | null
  indiceFidelidad:  number
  clasificacion:    'VERDE' | 'AMARILLO' | 'ROJO'
}

export interface LeaderFilters {
  zona?:           string
  clasificacion?:  'VERDE' | 'AMARILLO' | 'ROJO'
  desde?:          string
  hasta?:          string
}

export interface ProjectionData {
  votoSeguro:     number
  comprometido:   number
  simpatizante:   number
  contactado:     number
  sinContactar:   number
  totalProyectado: number
  metaVotos:      number | null
  votosAnterior:  number | null
}

export interface AnalyticsConfig {
  fechaEleccion:         string | null
  metaVotos:             number | null
  votosEleccionAnterior: number | null
}

// Dimensiones del radar para el análisis IA
export interface RadarDimension {
  dimension: string
  valor:     number // 0-100
}

export interface LeaderAnalysisResult {
  id:                string
  perfilTipo:        string
  indiceFidelidad:   number
  indiceRiesgo:      number
  veredicto:         string
  planAccion:        { accion: string; tiempo: string; responsable: string }[] | null
  senalesDetectadas: { señal: string; peso: 'ALTO' | 'MEDIO' | 'BAJO' }[]
  justificacion:     string
  generadoEn:        string
  radarDimensiones:  RadarDimension[]
}

// ── Helpers internos ──────────────────────────────────────────────────────────

async function getDbAndTenant(screenKey: string, accion: 'view' | 'edit' = 'view') {
  const session = await requireModuleOrScreen('ANALYTICS', ['ADMIN_CAMPANA', 'COORDINADOR'], screenKey, accion)
  const tenantId = session.user.tenantId
  const db = getTenantDb(await getTenantConnection(tenantId))
  return { db, tenantId }
}

// ── Dashboard KPIs ────────────────────────────────────────────────────────────

export async function getAnalyticsDashboard(): Promise<DashboardKpi> {
  const { db, tenantId } = await getDbAndTenant('ANALYTICS_DASHBOARD')

  const ahora       = new Date()
  const hoy         = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const hace7dias   = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000)
  const hace30dias  = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Líder = tiene algún título de red (ver titulosPorLider en core/actions.ts).
  const liderIds = await idsLideres(tenantId, db)

  const [
    totalRegistrados,
    byStatus,
    totalLideres,
    lideresConActividad,
    serieTemporal,
    registrosHoy,
    registrosSemana,
    config,
  ] = await Promise.all([
    db.voter.count({ where: { tenantId } }),

    db.voter.groupBy({
      by:     ['commitmentStatus'],
      _count: true,
      where:  { tenantId },
    }),

    Promise.resolve(liderIds.size),

    // Líderes con al menos un elector registrado en los últimos 7 días
    db.voter.count({
      where: {
        tenantId,
        id: { in: [...liderIds] },
        followers: { some: { createdAt: { gte: hace7dias } } },
      },
    }),

    // Serie temporal: registros por día últimos 30 días
    db.$queryRaw<{ dia: Date; total: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") as dia, COUNT(*)::bigint as total
      FROM "Voter"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= ${hace30dias}
      GROUP BY dia
      ORDER BY dia
    `,

    db.voter.count({ where: { tenantId, createdAt: { gte: hoy } } }),
    db.voter.count({ where: { tenantId, createdAt: { gte: hace7dias } } }),
    db.tenantConfig.findUnique({ where: { tenantId } }),
  ])

  // Mapear distribución por estado.
  // Prisma tipa `_count: true` como número en runtime, pero la inferencia del Map
  // a veces colapsa a `unknown`/`{}` durante next build → tipamos explícito.
  const statusMap = new Map<string, number>(
    byStatus.map((s) => [s.commitmentStatus, Number(s._count)] as const),
  )
  const comprometidos = (statusMap.get('COMPROMETIDO') ?? 0) + (statusMap.get('VOTO_SEGURO') ?? 0)
  const votoSeguro    = statusMap.get('VOTO_SEGURO') ?? 0
  const sinContactar  = statusMap.get('SIN_CONTACTAR') ?? 0

  const lideresActivos   = lideresConActividad
  const lideresInactivos = totalLideres - lideresActivos

  // % avance global: (comprometidos + voto_seguro) / meta
  const pctAvance = config?.metaVotos
    ? Math.round((comprometidos / config.metaVotos) * 100)
    : null

  // Días restantes hasta la elección
  let diasRestantes: number | null = null
  if (config?.fechaEleccion) {
    const diff = new Date(config.fechaEleccion).getTime() - ahora.getTime()
    diasRestantes = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  return {
    totalRegistrados,
    comprometidos,
    votoSeguro,
    sinContactar,
    totalLideres,
    lideresActivos,
    lideresInactivos,
    promedioElectoresPorLider: totalLideres > 0
      ? Math.round(totalRegistrados / totalLideres)
      : 0,
    pctAvance,
    diasRestantes,
    registrosHoy,
    registrosSemana,
    serieTemporal: serieTemporal.map((r) => ({
      dia:   new Date(r.dia).toISOString().slice(0, 10),
      total: Number(r.total),
    })),
    distribucion: [
      { estado: 'SIN_CONTACTAR', cantidad: statusMap.get('SIN_CONTACTAR') ?? 0 },
      { estado: 'CONTACTADO',    cantidad: statusMap.get('CONTACTADO') ?? 0 },
      { estado: 'SIMPATIZANTE',  cantidad: statusMap.get('SIMPATIZANTE') ?? 0 },
      { estado: 'COMPROMETIDO',  cantidad: statusMap.get('COMPROMETIDO') ?? 0 },
      { estado: 'VOTO_SEGURO',   cantidad: statusMap.get('VOTO_SEGURO') ?? 0 },
    ],
  }
}

// ── Análisis territorial ──────────────────────────────────────────────────────

export async function getAnalysisByTerritory(): Promise<TerritoryRow[]> {
  const { db, tenantId } = await getDbAndTenant('ANALYTICS_TERRITORIO')

  // Quién es líder lo decide titulosPorLider() en CORE, no un HAVING acá.
  // Antes estas dos consultas repetían la regla en SQL (>= N directos) y se
  // habrían desincronizado en silencio al cambiarla, mostrando en Analytics
  // un conteo de líderes distinto al del panel.
  const lideres = [...(await idsLideres(tenantId, db))]

  // Electores CON mesa asignada → agrupados por municipio
  const conMesa = await db.$queryRaw<{
    municipio: string
    divipola:  string
    registrados: bigint
    comprometidos: bigint
    lideres_activos: bigint
    meta: bigint
  }[]>`
    SELECT
      m.name                                                          AS municipio,
      m.divipola,
      COUNT(v.id)::bigint                                             AS registrados,
      COUNT(v.id) FILTER (
        WHERE v."commitmentStatus" IN ('COMPROMETIDO', 'VOTO_SEGURO')
      )::bigint                                                       AS comprometidos,
      COUNT(DISTINCT l.id) FILTER (
        WHERE l.status = 'ACTIVO' AND l.id = ANY(${lideres})
      )::bigint                                                       AS lideres_activos,
      COALESCE(SUM(DISTINCT l."targetVotes"), 0)::bigint              AS meta
    FROM "Voter" v
    JOIN "VotingTable"   vt ON v."votingTableId" = vt.id
    JOIN "VotingStation" vs ON vt."stationId"    = vs.id
    JOIN "Municipality"  m  ON vs."municipalityId" = m.id
    LEFT JOIN "Voter"    l  ON v."leaderId"      = l.id
    WHERE v."tenantId" = ${tenantId}
    GROUP BY m.id, m.name, m.divipola
    ORDER BY m.name
  `

  // Electores SIN mesa asignada
  const sinMesa = await db.$queryRaw<{
    registrados: bigint
    comprometidos: bigint
    lideres_activos: bigint
    meta: bigint
  }[]>`
    SELECT
      COUNT(v.id)::bigint                                             AS registrados,
      COUNT(v.id) FILTER (
        WHERE v."commitmentStatus" IN ('COMPROMETIDO', 'VOTO_SEGURO')
      )::bigint                                                       AS comprometidos,
      COUNT(DISTINCT l.id) FILTER (
        WHERE l.status = 'ACTIVO' AND l.id = ANY(${lideres})
      )::bigint                                                       AS lideres_activos,
      COALESCE(SUM(DISTINCT l."targetVotes"), 0)::bigint              AS meta
    FROM "Voter" v
    LEFT JOIN "Voter" l ON v."leaderId" = l.id
    WHERE v."tenantId" = ${tenantId}
      AND v."votingTableId" IS NULL
  `

  const rows: TerritoryRow[] = conMesa.map(r => {
    const registrados   = Number(r.registrados)
    const comprometidos = Number(r.comprometidos)
    const meta          = Number(r.meta)
    return {
      municipio:      r.municipio,
      divipola:       r.divipola,
      registrados,
      comprometidos,
      pctAvance:      meta > 0 ? Math.round((comprometidos / meta) * 100) : 0,
      meta,
      brecha:         Math.max(0, meta - comprometidos),
      lideresActivos: Number(r.lideres_activos),
    }
  })

  // Fila "Sin asignar" para electores sin mesa
  const sa = sinMesa[0]
  if (sa && Number(sa.registrados) > 0) {
    const registrados   = Number(sa.registrados)
    const comprometidos = Number(sa.comprometidos)
    const meta          = Number(sa.meta)
    rows.push({
      municipio:      'Sin asignar',
      divipola:       '—',
      registrados,
      comprometidos,
      pctAvance:      meta > 0 ? Math.round((comprometidos / meta) * 100) : 0,
      meta,
      brecha:         Math.max(0, meta - comprometidos),
      lideresActivos: Number(sa.lideres_activos),
    })
  }

  return rows
}

/** Genera CSV con los datos territoriales para descarga */
export async function exportTerritoryCSV(): Promise<string> {
  const rows = await getAnalysisByTerritory()

  const header = 'Municipio,DIVIPOLA,Registrados,Comprometidos,% Avance,Meta,Brecha,Líderes Activos'
  const lines = rows.map(r =>
    `"${r.municipio}",${r.divipola},${r.registrados},${r.comprometidos},${r.pctAvance}%,${r.meta},${r.brecha},${r.lideresActivos}`
  )

  return [header, ...lines].join('\n')
}

// ── Ranking de líderes ────────────────────────────────────────────────────────

export async function getLeaderAnalytics(filters?: LeaderFilters): Promise<LeaderAnalyticsRow[]> {
  const { db, tenantId } = await getDbAndTenant('ANALYTICS_LIDERES')

  // Construir where dinámico
  const where: Record<string, unknown> = { tenantId }
  if (filters?.zona) where.zone = filters.zona

  // Líder = tiene algún título de red (ver titulosPorLider en core/actions.ts).
  const liderIds = await idsLideres(tenantId, db)

  const leaders = await db.voter.findMany({
    where: { ...where, id: { in: [...liderIds] } },
    select: {
      id:          true,
      name:        true,
      zone:        true,
      targetVotes: true,
      // "Electores" del líder = followers que NO son a su vez líderes (sin
      // followers propios) — un sub-líder no cuenta hacia la meta del padre.
      followers: {
        select: {
          commitmentStatus: true,
          createdAt:        true,
          lastContact:      true,
        },
        where: {
          followers: { none: {} },
          ...(filters?.desde || filters?.hasta
            ? {
                createdAt: {
                  ...(filters.desde ? { gte: new Date(filters.desde) } : {}),
                  ...(filters.hasta ? { lte: new Date(filters.hasta) } : {}),
                },
              }
            : {}),
        },
      },
    },
  })

  // Buscar análisis previos para el componente historial del índice de fidelidad
  const leaderIds = leaders.map(l => l.id)
  const analisisPrevios = leaderIds.length > 0
    ? await db.leaderAnalysis.findMany({
        where: { tenantId, leaderId: { in: leaderIds } },
        orderBy: { generadoEn: 'desc' },
        distinct: ['leaderId'],
        select: { leaderId: true, indiceFidelidad: true },
      })
    : []
  const mapAnalisis = new Map(analisisPrevios.map(a => [a.leaderId, a.indiceFidelidad]))

  const ahora     = Date.now()
  const tresDias  = 3 * 24 * 60 * 60 * 1000
  const sieteDias = 7 * 24 * 60 * 60 * 1000

  const rows: LeaderAnalyticsRow[] = leaders.map(leader => {
    const electoresAsignados = leader.followers.length
    const comprometidos = leader.followers.filter(
      v => v.commitmentStatus === 'COMPROMETIDO' || v.commitmentStatus === 'VOTO_SEGURO'
    ).length

    const pctAvance = leader.targetVotes > 0
      ? Math.round((comprometidos / leader.targetVotes) * 100)
      : 0

    // Última actividad: MAX entre createdAt y lastContact de todos los voters
    let ultimaAct: Date | null = null
    for (const v of leader.followers) {
      if (!ultimaAct || v.createdAt > ultimaAct) ultimaAct = v.createdAt
      if (v.lastContact && (!ultimaAct || v.lastContact > ultimaAct)) ultimaAct = v.lastContact
    }

    // Índice de fidelidad (0-100)
    // base: (comprometidos / meta) * 60 (max 60)
    const base = leader.targetVotes > 0
      ? Math.min(60, Math.round((comprometidos / leader.targetVotes) * 60))
      : 0

    // actividad: < 3 días +20, < 7 días +10, > 7 días +0
    let puntosActividad = 0
    if (ultimaAct) {
      const diffMs = ahora - ultimaAct.getTime()
      if (diffMs < tresDias)       puntosActividad = 20
      else if (diffMs < sieteDias) puntosActividad = 10
    }

    // historial: si existe análisis previo, usa su indiceFidelidad
    // Si indiceFidelidad previo > 70 → +20, > 40 → +10, sino +0
    // Si no existe análisis previo, historial = 0 (primer período)
    let puntosHistorial = 0
    const prevFidelidad = mapAnalisis.get(leader.id)
    if (prevFidelidad !== undefined) {
      if (prevFidelidad >= 70)      puntosHistorial = 20
      else if (prevFidelidad >= 40) puntosHistorial = 10
    }

    const indiceFidelidad = Math.min(100, base + puntosActividad + puntosHistorial)

    // Clasificación de riesgo
    let clasificacion: 'VERDE' | 'AMARILLO' | 'ROJO'
    if (indiceFidelidad >= 70)      clasificacion = 'VERDE'
    else if (indiceFidelidad >= 40) clasificacion = 'AMARILLO'
    else                            clasificacion = 'ROJO'

    return {
      id:               leader.id,
      nombre:           leader.name,
      zona:             leader.zone,
      electoresAsignados,
      comprometidos,
      pctAvance,
      ultimaActividad:  ultimaAct ? ultimaAct.toISOString().slice(0, 10) : null,
      indiceFidelidad,
      clasificacion,
    }
  })

  // Filtrar por clasificación si se pidió
  const filtered = filters?.clasificacion
    ? rows.filter(r => r.clasificacion === filters.clasificacion)
    : rows

  // Ordenar por índice de fidelidad descendente
  return filtered.sort((a, b) => b.indiceFidelidad - a.indiceFidelidad)
}

// ── Agente IA de fidelidad ────────────────────────────────────────────────────

const SYSTEM_PROMPT_ANALISIS = `Eres un analista de comportamiento político especializado en psicología política electoral colombiana. Evalúa el perfil de fidelidad de este líder de base a partir de señales conductuales, históricas y de contexto.

Entrega tu análisis en este formato JSON exacto:
{
  "perfilTipo": string (Leal | Oportunista | Transaccional | Maximizador | DesertorPotencial),
  "indiceFidelidad": number (0-100),
  "indiceRiesgo": number (0-100),
  "senalesDetectadas": [{ "señal": string, "peso": "ALTO"|"MEDIO"|"BAJO" }],
  "veredicto": "FIDELIZAR" | "MONITOREAR" | "PRESCINDIR",
  "planAccion": [{ "accion": string, "tiempo": string, "responsable": string }] | null,
  "justificacion": string
}

Si el veredicto es PRESCINDIR, planAccion debe ser null.
Responde SOLO con el JSON, sin texto adicional ni markdown.`

export async function generarAnalisisLider(leaderId: string): Promise<LeaderAnalysisResult> {
  const { db, tenantId } = await getDbAndTenant('ANALYTICS_LIDERES', 'edit')

  // Verificar si ya existe un análisis reciente (< 24 horas)
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const reciente = await db.leaderAnalysis.findFirst({
    where: {
      tenantId,
      leaderId,
      generadoEn: { gte: hace24h },
    },
    orderBy: { generadoEn: 'desc' },
  })

  if (reciente) {
    return formatAnalysis(reciente, db, tenantId, leaderId)
  }

  // Construir contexto del líder
  const ahora      = new Date()
  const hace30dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [leader, voters, alertas, promedioTenant] = await Promise.all([
    db.voter.findUniqueOrThrow({
      where: { id: leaderId },
      select: { id: true, name: true, zone: true, targetVotes: true, status: true, createdAt: true },
    }),

    // Solo electores directos (no sub-líderes) — igual que en getLeaderAnalytics.
    db.voter.findMany({
      where: { tenantId, leaderId, followers: { none: {} } },
      select: {
        commitmentStatus: true,
        createdAt:        true,
        lastContact:      true,
        qrTokenUsed:      true,
      },
    }),

    db.voterDuplicateAlert.count({
      where: {
        tenantId,
        OR: [{ firstLeaderId: leaderId }, { duplicateLeaderId: leaderId }],
      },
    }),

    // Promedio de electores por líder en todo el tenant
    db.voter.count({ where: { tenantId } }).then(async total => {
      const lideres = (await idsLideres(tenantId, db)).size
      return lideres > 0 ? Math.round(total / lideres) : 0
    }),
  ])

  // Métricas del líder
  const totalVoters    = voters.length
  const comprometidos  = voters.filter(v => v.commitmentStatus === 'COMPROMETIDO' || v.commitmentStatus === 'VOTO_SEGURO').length
  const porQR          = voters.filter(v => v.qrTokenUsed !== null).length
  const porManual      = totalVoters - porQR
  const registrosUlt30 = voters.filter(v => v.createdAt >= hace30dias).length

  // Última actividad
  let ultimaActividad: Date | null = null
  for (const v of voters) {
    if (!ultimaActividad || v.createdAt > ultimaActividad) ultimaActividad = v.createdAt
    if (v.lastContact && (!ultimaActividad || v.lastContact > ultimaActividad)) ultimaActividad = v.lastContact
  }

  const contexto = {
    lider: {
      nombre:      leader.name,
      zona:        leader.zone,
      metaVotos:   leader.targetVotes,
      estado:      leader.status,
      fechaInicio: leader.createdAt.toISOString().slice(0, 10),
    },
    metricas: {
      totalElectores:   totalVoters,
      comprometidos,
      pctAvance:        leader.targetVotes > 0 ? Math.round((comprometidos / leader.targetVotes) * 100) : 0,
      registrosQR:      porQR,
      registrosManuales: porManual,
      registrosUltimos30Dias: registrosUlt30,
      ultimaActividad:  ultimaActividad?.toISOString().slice(0, 10) ?? 'sin actividad',
    },
    alertas: {
      duplicadosDetectados: alertas,
    },
    contextoTenant: {
      promedioElectoresPorLider: promedioTenant,
    },
    distribucion: {
      SIN_CONTACTAR: voters.filter(v => v.commitmentStatus === 'SIN_CONTACTAR').length,
      CONTACTADO:    voters.filter(v => v.commitmentStatus === 'CONTACTADO').length,
      SIMPATIZANTE:  voters.filter(v => v.commitmentStatus === 'SIMPATIZANTE').length,
      COMPROMETIDO:  voters.filter(v => v.commitmentStatus === 'COMPROMETIDO').length,
      VOTO_SEGURO:   voters.filter(v => v.commitmentStatus === 'VOTO_SEGURO').length,
    },
  }

  // Llamar al agente Zhipu Flash — SOLO con la clave propia del tenant. Si no
  // la configuró, cortar acá: nunca caer en silencio a process.env.ZHIPU_API_KEY
  // (el default de chatZhipu) y cobrar el análisis contra la cuota del SaaS.
  const { zhipu } = await getTenantAiKeys(tenantId)
  if (!zhipu) {
    throw new Error('Este tenant no tiene configurada su propia clave de IA (Zhipu). Configúrala en Configuración antes de generar el análisis.')
  }
  const respuesta = await chatZhipu(SYSTEM_PROMPT_ANALISIS, JSON.stringify(contexto), zhipu)

  // Parsear y validar JSON
  let resultado: {
    perfilTipo:        string
    indiceFidelidad:   number
    indiceRiesgo:      number
    senalesDetectadas: { señal: string; peso: string }[]
    veredicto:         string
    planAccion:        { accion: string; tiempo: string; responsable: string }[] | null
    justificacion:     string
  }

  try {
    resultado = JSON.parse(respuesta)
  } catch {
    throw new Error(`El agente IA retornó un JSON inválido. Intente regenerar el análisis.`)
  }

  // Validar campos obligatorios
  if (
    typeof resultado.perfilTipo !== 'string' ||
    typeof resultado.indiceFidelidad !== 'number' ||
    typeof resultado.indiceRiesgo !== 'number' ||
    !Array.isArray(resultado.senalesDetectadas) ||
    typeof resultado.veredicto !== 'string' ||
    typeof resultado.justificacion !== 'string'
  ) {
    throw new Error('El análisis del agente IA no tiene el formato esperado. Campos obligatorios faltantes.')
  }

  // Loguear solo leaderId y veredicto — nunca el response completo
  console.log(`[Analytics] Análisis generado para líder ${leaderId}: ${resultado.veredicto}`)

  // Guardar en DB
  const saved = await db.leaderAnalysis.create({
    data: {
      tenantId,
      leaderId,
      perfilTipo:        resultado.perfilTipo,
      indiceFidelidad:   resultado.indiceFidelidad,
      indiceRiesgo:      resultado.indiceRiesgo,
      veredicto:         resultado.veredicto,
      planAccion:        resultado.planAccion ?? undefined,
      senalesDetectadas: resultado.senalesDetectadas,
      justificacion:     resultado.justificacion,
    },
  })

  revalidatePath(`/analytics/lideres/${leaderId}/analisis`)

  return formatAnalysis(saved, db, tenantId, leaderId)
}

/** Formatea un LeaderAnalysis de Prisma al tipo de retorno con dimensiones de radar */
async function formatAnalysis(
  analysis: {
    id: string; perfilTipo: string; indiceFidelidad: number; indiceRiesgo: number
    veredicto: string; planAccion: unknown; senalesDetectadas: unknown
    justificacion: string; generadoEn: Date
  },
  db: ReturnType<typeof getTenantDb>,
  tenantId: string,
  leaderId: string,
): Promise<LeaderAnalysisResult> {
  // Calcular 6 dimensiones del radar desde los datos reales (solo electores directos)
  const voters = await db.voter.findMany({
    where: { tenantId, leaderId, followers: { none: {} } },
    select: { commitmentStatus: true, createdAt: true, lastContact: true },
  })

  const total       = voters.length
  const comprom     = voters.filter(v => v.commitmentStatus === 'COMPROMETIDO' || v.commitmentStatus === 'VOTO_SEGURO').length
  const contactados = voters.filter(v => v.commitmentStatus !== 'SIN_CONTACTAR').length

  const leader = await db.voter.findUnique({
    where: { id: leaderId },
    select: { targetVotes: true },
  })
  const meta = leader?.targetVotes ?? 0

  // Compromiso: % de electores comprometidos o voto seguro
  const compromiso = total > 0 ? Math.round((comprom / total) * 100) : 0

  // Actividad: basada en última actividad
  let ultimaAct: Date | null = null
  for (const v of voters) {
    if (!ultimaAct || v.createdAt > ultimaAct) ultimaAct = v.createdAt
    if (v.lastContact && (!ultimaAct || v.lastContact > ultimaAct)) ultimaAct = v.lastContact
  }
  let actividad = 0
  if (ultimaAct) {
    const diasSinAct = (Date.now() - ultimaAct.getTime()) / (1000 * 60 * 60 * 24)
    if (diasSinAct < 1)       actividad = 100
    else if (diasSinAct < 3)  actividad = 80
    else if (diasSinAct < 7)  actividad = 50
    else if (diasSinAct < 14) actividad = 25
  }

  // Retención: % de electores que pasaron de SIN_CONTACTAR a algo más
  const retencion = total > 0 ? Math.round((contactados / total) * 100) : 0

  // Cobertura territorial: avance hacia la meta
  const cobertura = meta > 0 ? Math.min(100, Math.round((total / meta) * 100)) : 0

  // Calidad de red: peso de voto_seguro sobre total comprometidos
  const votoSeguro = voters.filter(v => v.commitmentStatus === 'VOTO_SEGURO').length
  const calidadRed = comprom > 0 ? Math.round((votoSeguro / comprom) * 100) : 0

  // Historial: indiceFidelidad del propio análisis (refleja tendencia)
  const historial = analysis.indiceFidelidad

  return {
    id:                analysis.id,
    perfilTipo:        analysis.perfilTipo,
    indiceFidelidad:   analysis.indiceFidelidad,
    indiceRiesgo:      analysis.indiceRiesgo,
    veredicto:         analysis.veredicto,
    planAccion:        analysis.planAccion as LeaderAnalysisResult['planAccion'],
    senalesDetectadas: analysis.senalesDetectadas as LeaderAnalysisResult['senalesDetectadas'],
    justificacion:     analysis.justificacion,
    generadoEn:        analysis.generadoEn.toISOString(),
    radarDimensiones: [
      { dimension: 'Compromiso',  valor: compromiso },
      { dimension: 'Actividad',   valor: actividad },
      { dimension: 'Retención',   valor: retencion },
      { dimension: 'Cobertura',   valor: cobertura },
      { dimension: 'Calidad de red', valor: calidadRed },
      { dimension: 'Historial',   valor: historial },
    ],
  }
}

// ── Proyección de votos ───────────────────────────────────────────────────────

export async function getProjectionData(): Promise<ProjectionData> {
  const { db, tenantId } = await getDbAndTenant('ANALYTICS_PROYECCION')

  const [byStatus, config] = await Promise.all([
    db.voter.groupBy({
      by:     ['commitmentStatus'],
      _count: true,
      where:  { tenantId },
    }),
    db.tenantConfig.findUnique({ where: { tenantId } }),
  ])

  const statusMap = new Map<string, number>(
    byStatus.map((s) => [s.commitmentStatus, Number(s._count)] as const),
  )

  const votoSeguro    = statusMap.get('VOTO_SEGURO') ?? 0
  const comprometido  = statusMap.get('COMPROMETIDO') ?? 0
  const simpatizante  = statusMap.get('SIMPATIZANTE') ?? 0
  const contactado    = statusMap.get('CONTACTADO') ?? 0
  const sinContactar  = statusMap.get('SIN_CONTACTAR') ?? 0

  const totalProyectado = Math.round(
    votoSeguro * 1.0 +
    comprometido * 0.85 +
    simpatizante * 0.40
  )

  return {
    votoSeguro,
    comprometido,
    simpatizante,
    contactado,
    sinContactar,
    totalProyectado,
    metaVotos:     config?.metaVotos ?? null,
    votosAnterior: config?.votosEleccionAnterior ?? null,
  }
}

// ── Configuración ─────────────────────────────────────────────────────────────

export async function getAnalyticsConfig(): Promise<AnalyticsConfig> {
  const { db, tenantId } = await getDbAndTenant('ANALYTICS_CONFIGURACION')

  const config = await db.tenantConfig.findUnique({ where: { tenantId } })

  return {
    fechaEleccion:         config?.fechaEleccion?.toISOString().slice(0, 10) ?? null,
    metaVotos:             config?.metaVotos ?? null,
    votosEleccionAnterior: config?.votosEleccionAnterior ?? null,
  }
}

export async function updateAnalyticsConfig(data: {
  fechaEleccion?:         string | null
  metaVotos?:             number | null
  votosEleccionAnterior?: number | null
}): Promise<void> {
  const { db, tenantId } = await getDbAndTenant('ANALYTICS_CONFIGURACION', 'edit')

  await db.tenantConfig.upsert({
    where:  { tenantId },
    create: {
      tenantId,
      fechaEleccion:         data.fechaEleccion ? new Date(data.fechaEleccion) : null,
      metaVotos:             data.metaVotos ?? null,
      votosEleccionAnterior: data.votosEleccionAnterior ?? null,
    },
    update: {
      fechaEleccion:         data.fechaEleccion ? new Date(data.fechaEleccion) : null,
      metaVotos:             data.metaVotos ?? null,
      votosEleccionAnterior: data.votosEleccionAnterior ?? null,
    },
  })

  revalidatePath('/analytics')
  revalidatePath('/analytics/configuracion')
}
