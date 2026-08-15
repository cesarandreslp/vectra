import Link from 'next/link'
import { listExpenses, exportExpensesCsv } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { ExportCsvButton } from './_export-csv-button'

const CATEGORY_LABELS: Record<string, string> = {
  PUBLICIDAD:  'Publicidad',
  TRANSPORTE:  'Transporte',
  LOGISTICA:   'Logística',
  PERSONAL:    'Personal',
  TECNOLOGIA:  'Tecnología',
  EVENTOS:     'Eventos',
  JURIDICO:    'Jurídico',
  OTRO:        'Otro',
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  PUBLICIDAD:  { bg: '#dbeafe', color: '#1e40af' },
  TRANSPORTE:  { bg: '#fef3c7', color: '#92400e' },
  LOGISTICA:   { bg: '#ede9fe', color: '#5b21b6' },
  PERSONAL:    { bg: '#fee2e2', color: '#991b1b' },
  TECNOLOGIA:  { bg: '#cffafe', color: '#155e75' },
  EVENTOS:     { bg: '#dcfce7', color: '#166534' },
  JURIDICO:    { bg: '#ffedd5', color: '#9a3412' },
  OTRO:        { bg: '#f1f5f9', color: '#334155' },
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  REGISTRADO: { bg: '#f1f5f9', color: '#334155' },
  VERIFICADO: { bg: '#dcfce7', color: '#166534' },
  OBSERVADO:  { bg: '#fee2e2', color: '#991b1b' },
}

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`
}

export default async function GastosPage() {
  await requireModuleOrRedirect('FINANZAS')

  const result = await listExpenses()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
          Gastos de campaña
        </h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <ExportCsvButton exportAction={exportExpensesCsv} fileName="gastos-campana.csv" />
          <Link
            href="/finanzas/gastos/nuevo"
            style={{
              padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '6px',
              border: 'none', background: '#1e40af', color: '#fff',
              textDecoration: 'none', fontWeight: 600,
            }}
          >
            Registrar gasto
          </Link>
        </div>
      </div>

      {/* Tabla de gastos */}
      <div style={{
        background: '#fff', borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Fecha', 'Categoría', 'Descripción', 'Proveedor', 'Monto', 'Estado'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.expenses.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  No hay gastos registrados
                </td>
              </tr>
            ) : result.expenses.map(e => {
              const catColor = CATEGORY_COLORS[e.category] ?? { bg: '#f1f5f9', color: '#334155' }
              const statusColor = STATUS_COLORS[e.status] ?? { bg: '#f1f5f9', color: '#334155' }
              return (
                <tr key={e.id}>
                  <td style={tdStyle}>{new Date(e.date).toLocaleDateString('es-CO')}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.1rem 0.4rem', borderRadius: '9999px',
                      fontSize: '0.65rem', fontWeight: 600,
                      background: catColor.bg, color: catColor.color,
                    }}>
                      {CATEGORY_LABELS[e.category] ?? e.category}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: '200px' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.description}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: '#64748b' }}>{e.vendor ?? '—'}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, textAlign: 'right' }}>
                    {formatCOP(e.amount)}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.1rem 0.4rem', borderRadius: '9999px',
                      fontSize: '0.65rem', fontWeight: 600,
                      background: statusColor.bg, color: statusColor.color,
                    }}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Totales por categoría */}
      {result.byCategory.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#334155' }}>
            Totales por categoría
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
            {result.byCategory.map(c => {
              const colors = CATEGORY_COLORS[c.category] ?? { bg: '#f1f5f9', color: '#334155' }
              return (
                <div key={c.category} style={{
                  padding: '0.75rem', borderRadius: '8px', background: colors.bg,
                }}>
                  <div style={{ fontSize: '0.7rem', color: colors.color, fontWeight: 500 }}>
                    {CATEGORY_LABELS[c.category] ?? c.category} ({c.count})
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: colors.color }}>
                    {formatCOP(c.total)}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{
            marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '2px solid #e2e8f0',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 600, color: '#334155' }}>Total general</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>
              {formatCOP(result.totalAmount)}
            </span>
          </div>
        </div>
      )}
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
