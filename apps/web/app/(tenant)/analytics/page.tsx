import { getAnalyticsDashboard } from './actions'
import { KpiCard }              from './_components/kpi-card'
import { ChartRegistros }       from './_components/chart-registros'
import { ChartCompromiso }      from './_components/chart-compromiso'

export default async function AnalyticsDashboardPage() {
  const kpi = await getAnalyticsDashboard()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>Dashboard de Analítica</h1>

      {/* Fila 1 — Métricas globales de electores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <KpiCard titulo="Total registrados" valor={kpi.totalRegistrados} />
        <KpiCard titulo="Comprometidos"     valor={kpi.comprometidos} color="#34d399" />
        <KpiCard titulo="Voto seguro"       valor={kpi.votoSeguro}    color="#22c55e" />
        <KpiCard titulo="Sin contactar"     valor={kpi.sinContactar}  color="#94a3b8" />
      </div>

      {/* Fila 2 — Métricas de líderes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <KpiCard titulo="Total líderes"    valor={kpi.totalLideres} />
        <KpiCard titulo="Líderes activos"  valor={kpi.lideresActivos}   color="#3b82f6" subtitulo="Actividad < 7 días" />
        <KpiCard titulo="Líderes inactivos" valor={kpi.lideresInactivos} color="#ef4444" subtitulo="Sin actividad > 7 días" />
        <KpiCard titulo="Promedio elect./líder" valor={kpi.promedioElectoresPorLider} />
      </div>

      {/* Fila 3 — Progreso general */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <KpiCard
          titulo="% Avance global"
          valor={kpi.pctAvance !== null ? `${kpi.pctAvance}%` : '—'}
          subtitulo="Comprometidos / meta total"
          color="#8b5cf6"
        />
        <KpiCard
          titulo="Días restantes"
          valor={kpi.diasRestantes !== null ? kpi.diasRestantes : '—'}
          subtitulo="Hasta la elección"
          color="#f59e0b"
        />
        <KpiCard titulo="Registros hoy"       valor={kpi.registrosHoy} color="#3b82f6" />
        <KpiCard titulo="Registros esta semana" valor={kpi.registrosSemana} color="#3b82f6" />
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <ChartRegistros  data={kpi.serieTemporal} />
        <ChartCompromiso data={kpi.distribucion} />
      </div>
    </div>
  )
}
