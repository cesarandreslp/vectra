import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb }         from '@vectra/db'
import { FichaAnalisis }       from './_components/ficha-analisis'
import type { LeaderAnalysisResult, RadarDimension } from '../../../actions'

export default async function AnalisisLiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: leaderId } = await params
  const session = await requireModuleOrRedirect('ANALYTICS', ['ADMIN_CAMPANA', 'COORDINADOR'], 'ANALYTICS_LIDERES')
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))
  const tenantId = session.user.tenantId

  // Buscar datos del líder
  const leader = await db.voter.findUnique({
    where: { id: leaderId },
    select: { name: true, zone: true },
  })

  if (!leader) {
    return <p style={{ color: '#ef4444' }}>Líder no encontrado.</p>
  }

  // Buscar análisis más reciente (< 24h)
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const reciente = await db.leaderAnalysis.findFirst({
    where:   { tenantId, leaderId, generadoEn: { gte: hace24h } },
    orderBy: { generadoEn: 'desc' },
  })

  let initial: LeaderAnalysisResult | null = null

  if (reciente) {
    // Calcular dimensiones de radar desde datos reales
    const voters = await db.voter.findMany({
      where: { tenantId, leaderId, followers: { none: {} } },
      select: { commitmentStatus: true, createdAt: true, lastContact: true },
    })
    const leaderData = await db.voter.findUnique({
      where: { id: leaderId },
      select: { targetVotes: true },
    })

    const total       = voters.length
    const comprom     = voters.filter(v => v.commitmentStatus === 'COMPROMETIDO' || v.commitmentStatus === 'VOTO_SEGURO').length
    const contactados = voters.filter(v => v.commitmentStatus !== 'SIN_CONTACTAR').length
    const votoSeguro  = voters.filter(v => v.commitmentStatus === 'VOTO_SEGURO').length
    const meta        = leaderData?.targetVotes ?? 0

    const compromiso = total > 0 ? Math.round((comprom / total) * 100) : 0
    const retencion  = total > 0 ? Math.round((contactados / total) * 100) : 0
    const cobertura  = meta > 0 ? Math.min(100, Math.round((total / meta) * 100)) : 0
    const calidadRed = comprom > 0 ? Math.round((votoSeguro / comprom) * 100) : 0

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

    const radarDimensiones: RadarDimension[] = [
      { dimension: 'Compromiso',     valor: compromiso },
      { dimension: 'Actividad',      valor: actividad },
      { dimension: 'Retención',      valor: retencion },
      { dimension: 'Cobertura',      valor: cobertura },
      { dimension: 'Calidad de red', valor: calidadRed },
      { dimension: 'Historial',      valor: reciente.indiceFidelidad },
    ]

    initial = {
      id:                reciente.id,
      perfilTipo:        reciente.perfilTipo,
      indiceFidelidad:   reciente.indiceFidelidad,
      indiceRiesgo:      reciente.indiceRiesgo,
      veredicto:         reciente.veredicto,
      planAccion:        reciente.planAccion as LeaderAnalysisResult['planAccion'],
      senalesDetectadas: reciente.senalesDetectadas as LeaderAnalysisResult['senalesDetectadas'],
      justificacion:     reciente.justificacion,
      generadoEn:        reciente.generadoEn.toISOString(),
      radarDimensiones,
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
          Análisis de fidelidad
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
          {leader.name} {leader.zone ? `· ${leader.zone}` : ''}
        </p>
      </div>
      <FichaAnalisis leaderId={leaderId} initial={initial} />
    </div>
  )
}
