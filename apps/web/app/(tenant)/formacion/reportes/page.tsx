import { getFormacionMetrics, getWitnessProgress } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { TablaProgreso } from './_components/tabla-progreso'

export default async function ReportesPage() {
  await requireModuleOrRedirect('FORMACION', ['ADMIN_CAMPANA'])

  const [metrics, witnesses] = await Promise.all([
    getFormacionMetrics(),
    getWitnessProgress(),
  ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
        Reportes de formación
      </h1>

      {/* KPI cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '1rem',
      }}>
        <MetricCard label="Materiales" value={metrics.totalMaterials} />
        <MetricCard label="Sesiones" value={metrics.totalSessions} />
        <MetricCard label="Evaluaciones" value={metrics.totalQuizzes} />
        <MetricCard label="Certificados" value={metrics.totalCertificates} />
        <MetricCard label="Testigos" value={metrics.totalWitnesses} />
        <MetricCard
          label="Tasa de aprobación"
          value={metrics.avgPassRate !== null ? `${metrics.avgPassRate}%` : '—'}
        />
      </div>

      {/* Tabla de progreso de testigos */}
      <TablaProgreso witnesses={witnesses} />
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', gap: '0.25rem',
    }}>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', color: '#0f172a', fontWeight: 700 }}>
        {value}
      </div>
    </div>
  )
}
