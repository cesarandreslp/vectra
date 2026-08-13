import Link from 'next/link'
import { listCampaigns } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'

export default async function CampanasPage() {
  await requireModuleOrRedirect('COMUNICACIONES')

  const campaigns = await listCampaigns()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
          Campañas de mensajes
        </h1>
        <Link
          href="/comunicaciones/campanas/nueva"
          style={{
            padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '6px',
            background: '#1e40af', color: '#fff', textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Nueva campaña
        </Link>
      </div>

      {campaigns.length > 0 ? (
        <div style={{
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflowX: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nombre', 'Canal', 'Estado', 'Destinatarios', 'Enviados', 'Fallidos', 'Éxito', 'Fecha'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id}>
                  <td style={tdStyle}>
                    <Link href={`/comunicaciones/campanas/${c.id}`}
                      style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 500 }}>
                      {c.name}
                    </Link>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.15rem 0.5rem', borderRadius: '9999px',
                      fontSize: '0.7rem', fontWeight: 600,
                      background: c.channel === 'EMAIL' ? '#dbeafe' : c.channel === 'SMS' ? '#dcfce7' : '#d1fae5',
                      color: c.channel === 'EMAIL' ? '#1e40af' : c.channel === 'SMS' ? '#166534' : '#065f46',
                    }}>
                      {c.channel}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{c.totalRecipients}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#166534' }}>{c.totalSent}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: c.totalFailed > 0 ? '#991b1b' : '#64748b' }}>
                    {c.totalFailed}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{c.successRate}%</td>
                  <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>
                    {c.sentAt
                      ? new Date(c.sentAt).toLocaleDateString('es-CO')
                      : new Date(c.createdAt).toLocaleDateString('es-CO')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '3rem',
          textAlign: 'center', color: '#94a3b8',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          No hay campañas creadas. Crea la primera.
        </div>
      )}
    </div>
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
