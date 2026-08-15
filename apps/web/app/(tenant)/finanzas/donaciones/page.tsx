import Link from 'next/link'
import { listDonations, exportDonationsCsv } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { ExportCsvButton } from '../gastos/_export-csv-button'

const DONOR_TYPE_LABELS: Record<string, string> = {
  PERSONA_NATURAL:  'Persona natural',
  PERSONA_JURIDICA: 'Persona jurídica',
  APORTE_PROPIO:    'Aporte propio',
}

const DONOR_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  PERSONA_NATURAL:  { bg: '#dbeafe', color: '#1e40af' },
  PERSONA_JURIDICA: { bg: '#ede9fe', color: '#5b21b6' },
  APORTE_PROPIO:    { bg: '#fef3c7', color: '#92400e' },
}

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`
}

export default async function DonacionesPage() {
  await requireModuleOrRedirect('FINANZAS')

  const donations = await listDonations()
  const total = donations.reduce((sum, d) => sum + d.amount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
          Donaciones recibidas
        </h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <ExportCsvButton exportAction={exportDonationsCsv} fileName="donaciones-campana.csv" />
          <Link
            href="/finanzas/donaciones/nueva"
            style={{
              padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '6px',
              border: 'none', background: '#22c55e', color: '#fff',
              textDecoration: 'none', fontWeight: 600,
            }}
          >
            Registrar donación
          </Link>
        </div>
      </div>

      {/* Tabla de donaciones */}
      <div style={{
        background: '#fff', borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Fecha', 'Donante', 'Tipo', 'Monto', 'Verificado'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {donations.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  No hay donaciones registradas
                </td>
              </tr>
            ) : donations.map(d => {
              const typeColor = DONOR_TYPE_COLORS[d.donorType] ?? { bg: '#f1f5f9', color: '#334155' }
              return (
                <tr key={d.id}>
                  <td style={tdStyle}>{new Date(d.date).toLocaleDateString('es-CO')}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{d.donorName}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.1rem 0.4rem', borderRadius: '9999px',
                      fontSize: '0.65rem', fontWeight: 600,
                      background: typeColor.bg, color: typeColor.color,
                    }}>
                      {DONOR_TYPE_LABELS[d.donorType] ?? d.donorType}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, textAlign: 'right', color: '#22c55e' }}>
                    {formatCOP(d.amount)}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.1rem 0.4rem', borderRadius: '9999px',
                      fontSize: '0.65rem', fontWeight: 600,
                      background: d.isVerified ? '#dcfce7' : '#f1f5f9',
                      color: d.isVerified ? '#166534' : '#94a3b8',
                    }}>
                      {d.isVerified ? 'Verificado' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {donations.length > 0 && (
          <div style={{
            padding: '0.75rem 1rem', borderTop: '2px solid #e2e8f0',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>
              Total ({donations.length} donaciones)
            </span>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#22c55e' }}>
              {formatCOP(total)}
            </span>
          </div>
        )}
      </div>
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
