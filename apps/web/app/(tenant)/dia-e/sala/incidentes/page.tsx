import { listIncidents, updateIncidentStatus } from '../../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { AutoRefresh } from '../_components/auto-refresh'

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  ALTA:  { bg: '#fee2e2', text: '#991b1b' },
  MEDIA: { bg: '#fef3c7', text: '#92400e' },
  BAJA:  { bg: '#f1f5f9', text: '#64748b' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ABIERTO:      { bg: '#fee2e2', text: '#991b1b' },
  EN_REVISION:  { bg: '#fef3c7', text: '#92400e' },
  RESUELTO:     { bg: '#dcfce7', text: '#166534' },
}

export default async function IncidentesPage() {
  await requireModuleOrRedirect('DIA_E', ['ADMIN_CAMPANA', 'COORDINADOR'])

  const incidents = await listIncidents()

  return (
    <AutoRefresh interval={30000}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
          Centro de incidentes
        </h1>

        {incidents.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {incidents.map(inc => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </div>
        ) : (
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '3rem',
            textAlign: 'center', color: '#94a3b8',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            No hay incidentes reportados
          </div>
        )}
      </div>
    </AutoRefresh>
  )
}

function IncidentCard({ incident: inc }: {
  incident: {
    id: string; type: string; description: string; severity: string
    status: string; reporterEmail: string; photoUrl: string | null; createdAt: Date
  }
}) {
  const sevColors = SEVERITY_COLORS[inc.severity] ?? SEVERITY_COLORS.MEDIA
  const staColors = STATUS_COLORS[inc.status] ?? STATUS_COLORS.ABIERTO

  async function handleToRevision() {
    'use server'
    await updateIncidentStatus(inc.id, 'EN_REVISION')
  }
  async function handleResolve() {
    'use server'
    await updateIncidentStatus(inc.id, 'RESUELTO')
  }

  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      borderLeft: `4px solid ${sevColors.text}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{
            padding: '0.15rem 0.5rem', borderRadius: '9999px',
            fontSize: '0.7rem', fontWeight: 600,
            background: sevColors.bg, color: sevColors.text,
          }}>
            {inc.severity}
          </span>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{inc.type}</span>
        </div>
        <span style={{
          padding: '0.15rem 0.5rem', borderRadius: '9999px',
          fontSize: '0.7rem', fontWeight: 600,
          background: staColors.bg, color: staColors.text,
        }}>
          {inc.status}
        </span>
      </div>

      <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#0f172a' }}>
        {inc.description}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          {inc.reporterEmail} — {new Date(inc.createdAt).toLocaleTimeString('es-CO')}
          {inc.photoUrl && (
            <a href={inc.photoUrl} target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: '0.5rem', color: '#1e40af' }}>
              Ver foto
            </a>
          )}
        </div>

        {inc.status !== 'RESUELTO' && (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {inc.status === 'ABIERTO' && (
              <form action={handleToRevision}>
                <button type="submit" style={actionBtnStyle}>En revisión</button>
              </form>
            )}
            <form action={handleResolve}>
              <button type="submit" style={{ ...actionBtnStyle, background: '#dcfce7', color: '#166534', border: '1px solid #22c55e' }}>
                Resuelto
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

const actionBtnStyle: React.CSSProperties = {
  padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px',
  border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer',
  color: '#334155', fontWeight: 500,
}
