import Link from 'next/link'
import { getCampaignDetail, sendCampaign } from '../../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'

export default async function CampanaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleOrRedirect('COMUNICACIONES', ['ADMIN_CAMPANA'])

  const { id } = await params
  const campaign = await getCampaignDetail(id)

  async function handleSend() {
    'use server'
    await sendCampaign(id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link href="/comunicaciones/campanas"
            style={{ fontSize: '0.8rem', color: '#64748b', textDecoration: 'none' }}>
            &larr; Campañas
          </Link>
          <h1 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', color: '#0f172a' }}>
            {campaign.name}
          </h1>
        </div>
        {['BORRADOR', 'PROGRAMADA'].includes(campaign.status) && (
          <form action={handleSend}>
            <button type="submit" style={{
              padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '6px',
              border: 'none', background: '#1e40af', color: '#fff',
              cursor: 'pointer', fontWeight: 600,
            }}>
              Enviar ahora
            </button>
          </form>
        )}
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <MetricCard label="Destinatarios" value={campaign.totalRecipients} />
        <MetricCard label="Enviados" value={campaign.totalSent} color="#22c55e" />
        <MetricCard label="Fallidos" value={campaign.totalFailed} color="#ef4444" />
        <MetricCard label="Tasa de éxito" value={`${campaign.successRate}%`} color="#3b82f6" />
      </div>

      {/* Info de la campaña */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#334155' }}>Detalles</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
          <div><strong>Canal:</strong> {campaign.channel}</div>
          <div><strong>Estado:</strong> {campaign.status}</div>
          <div><strong>Plantilla:</strong> {campaign.templateName}</div>
          <div><strong>Creada:</strong> {new Date(campaign.createdAt).toLocaleString('es-CO')}</div>
          {campaign.sentAt && (
            <div><strong>Enviada:</strong> {new Date(campaign.sentAt).toLocaleString('es-CO')}</div>
          )}
          {campaign.scheduledAt && (
            <div><strong>Programada:</strong> {new Date(campaign.scheduledAt).toLocaleString('es-CO')}</div>
          )}
        </div>
      </div>

      {/* Mensajes fallidos */}
      {campaign.failedMessages.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <h2 style={{ margin: 0, padding: '1rem 1.25rem', fontSize: '1rem', color: '#991b1b', borderBottom: '1px solid #f1f5f9' }}>
            Mensajes fallidos ({campaign.failedMessages.length})
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Tipo', 'Estado', 'Razón', 'Fecha'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaign.failedMessages.map(m => (
                <tr key={m.id}>
                  <td style={tdStyle}>{m.recipientType}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.1rem 0.4rem', borderRadius: '9999px',
                      fontSize: '0.7rem', fontWeight: 600,
                      background: '#fee2e2', color: '#991b1b',
                    }}>
                      {m.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: '#64748b', fontSize: '0.8rem' }}>
                    {m.failReason ?? '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>
                    {new Date(m.createdAt).toLocaleTimeString('es-CO')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, color }: {
  label: string; value: string | number; color?: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      borderLeft: color ? `4px solid ${color}` : undefined,
    }}>
      <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color ?? '#0f172a' }}>{value}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9',
}
