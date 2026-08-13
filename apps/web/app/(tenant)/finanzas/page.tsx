import Link from 'next/link'
import { getFinanceDashboard } from './actions'
import { requireModule } from '@/lib/auth-helpers'
import { BarraTope } from './_components/barra-tope'
import { AlertaTope } from './_components/alerta-tope'
import { ChartGastos } from './_components/chart-gastos'

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`
}

export default async function FinanzasDashboardPage() {
  await requireModule('FINANZAS')

  const data = await getFinanceDashboard()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '900px' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
          Dashboard Financiero
        </h1>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: data.tesorero ? '#475569' : '#b45309' }}>
          {data.tesorero
            ? <>Tesorero: <strong style={{ fontWeight: 600 }}>{data.tesorero}</strong> · <Link href="/finanzas/configuracion" style={{ color: '#1e40af' }}>cambiar</Link></>
            : <>Sin tesorero asignado · <Link href="/finanzas/configuracion" style={{ color: '#1e40af' }}>asignar</Link></>}
        </p>
      </div>

      {/* Métricas principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <MetricCard label="Total gastos" value={formatCOP(data.totalGastos)} color="#dc2626" />
        <MetricCard label="Total donaciones" value={formatCOP(data.totalDonaciones)} color="#22c55e" />
        <MetricCard
          label="Balance"
          value={formatCOP(data.balance)}
          color={data.balance >= 0 ? '#22c55e' : '#dc2626'}
        />
        <MetricCard
          label="% del tope"
          value={data.porcentajeTope !== null ? `${data.porcentajeTope.toFixed(1)}%` : 'N/A'}
          color={
            data.porcentajeTope === null ? '#94a3b8'
              : data.porcentajeTope > 80 ? '#dc2626'
              : data.porcentajeTope > 60 ? '#f59e0b'
              : '#22c55e'
          }
        />
      </div>

      {/* Barra de progreso del tope */}
      {data.topeGastos !== null && data.porcentajeTope !== null && (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <BarraTope
            gastado={data.totalGastos}
            tope={data.topeGastos}
            porcentaje={data.porcentajeTope}
          />
        </div>
      )}

      {/* Alertas */}
      <AlertaTope alertas={data.alertas} />

      {/* Gráfico de gastos por categoría */}
      <ChartGastos data={data.gastosPorCategoria} />

      {/* Tablas compactas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {/* Últimos 5 gastos */}
        <div style={{
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <div style={{ padding: '1rem 1rem 0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
            Últimos gastos
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Fecha', 'Categoría', 'Monto'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.ultimos5Gastos.length === 0 ? (
                <tr><td colSpan={3} style={{ ...tdStyle, color: '#94a3b8', textAlign: 'center' }}>Sin gastos</td></tr>
              ) : data.ultimos5Gastos.map(e => (
                <tr key={e.id}>
                  <td style={tdStyle}>{new Date(e.date).toLocaleDateString('es-CO')}</td>
                  <td style={tdStyle}>
                    <CategoryBadge category={e.category} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {formatCOP(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Últimas 5 donaciones */}
        <div style={{
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <div style={{ padding: '1rem 1rem 0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
            Últimas donaciones
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Fecha', 'Donante', 'Monto'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.ultimas5Donaciones.length === 0 ? (
                <tr><td colSpan={3} style={{ ...tdStyle, color: '#94a3b8', textAlign: 'center' }}>Sin donaciones</td></tr>
              ) : data.ultimas5Donaciones.map(d => (
                <tr key={d.id}>
                  <td style={tdStyle}>{new Date(d.date).toLocaleDateString('es-CO')}</td>
                  <td style={tdStyle}>{d.donorName}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#22c55e' }}>
                    {formatCOP(d.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  )
}

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

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] ?? { bg: '#f1f5f9', color: '#334155' }
  return (
    <span style={{
      padding: '0.1rem 0.4rem', borderRadius: '9999px',
      fontSize: '0.65rem', fontWeight: 600,
      background: colors.bg, color: colors.color,
    }}>
      {CATEGORY_LABELS[category] ?? category}
    </span>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.7rem',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9',
}
