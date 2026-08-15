import Link from 'next/link'
import { getDashboardMetrics } from './actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'

export default async function ComunicacionesDashboardPage() {
  await requireModuleOrRedirect('COMUNICACIONES')

  const metrics = await getDashboardMetrics()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
        Comunicaciones
      </h1>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <MetricCard label="Enviados" value={metrics.totalSent} color="#22c55e" />
        <MetricCard label="Tasa de éxito" value={`${metrics.successRate}%`} color="#3b82f6" />
        <MetricCard label="Campañas activas" value={metrics.activeCampaigns} color="#8b5cf6" />
        <MetricCard label="Esta semana" value={metrics.thisWeekSent} color="#f59e0b" />
      </div>

      {/* Últimas campañas */}
      <div style={{
        background: '#fff', borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9',
        }}>
          <h2 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>
            Últimas campañas
          </h2>
          <Link
            href="/comunicaciones/campanas/nueva"
            style={{
              padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '6px',
              background: '#1e40af', color: '#fff', textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Nueva campaña
          </Link>
        </div>

        {metrics.recentCampaigns.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nombre', 'Canal', 'Estado', 'Enviados', 'Éxito', 'Fecha'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.recentCampaigns.map(c => (
                <tr key={c.id}>
                  <td style={tdStyle}>
                    <Link href={`/comunicaciones/campanas/${c.id}`}
                      style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 500 }}>
                      {c.name}
                    </Link>
                  </td>
                  <td style={tdStyle}>
                    <ChannelBadge channel={c.channel} />
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={tdStyle}>{c.totalSent}/{c.totalRecipients}</td>
                  <td style={tdStyle}>{c.successRate}%</td>
                  <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>
                    {new Date(c.createdAt).toLocaleDateString('es-CO')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            Aún no hay campañas. Crea la primera.
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, color }: {
  label: string; value: string | number; color: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>
        {value}
      </div>
    </div>
  )
}

function ChannelBadge({ channel }: { channel: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    EMAIL:    { bg: '#dbeafe', text: '#1e40af' },
    SMS:      { bg: '#dcfce7', text: '#166534' },
    WHATSAPP: { bg: '#d1fae5', text: '#065f46' },
  }
  const c = colors[channel] ?? { bg: '#f1f5f9', text: '#64748b' }
  return (
    <span style={{
      padding: '0.15rem 0.5rem', borderRadius: '9999px',
      fontSize: '0.7rem', fontWeight: 600,
      background: c.bg, color: c.text,
    }}>
      {channel}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    BORRADOR:   { bg: '#f1f5f9', text: '#64748b' },
    PROGRAMADA: { bg: '#fef3c7', text: '#92400e' },
    ENVIANDO:   { bg: '#dbeafe', text: '#1e40af' },
    COMPLETADA: { bg: '#dcfce7', text: '#166534' },
    FALLIDA:    { bg: '#fee2e2', text: '#991b1b' },
  }
  const c = colors[status] ?? { bg: '#f1f5f9', text: '#64748b' }
  return (
    <span style={{
      padding: '0.15rem 0.5rem', borderRadius: '9999px',
      fontSize: '0.7rem', fontWeight: 600,
      background: c.bg, color: c.text,
    }}>
      {status}
    </span>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9',
}
