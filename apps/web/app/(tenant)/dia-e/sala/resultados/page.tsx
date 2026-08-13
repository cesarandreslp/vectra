import { getElectionResults } from '../../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { AutoRefresh } from '../_components/auto-refresh'

export default async function ResultadosPage() {
  await requireModuleOrRedirect('DIA_E', ['ADMIN_CAMPANA', 'COORDINADOR'])

  const results = await getElectionResults()
  const totalVotes   = results.reduce((s, r) => s + r.totalVotes, 0)
  const tableCount   = results[0]?.tableCount ?? 0
  const totalTables  = results[0]?.totalTables ?? 0
  const coverage     = totalTables > 0 ? Math.round((tableCount / totalTables) * 100) : 0

  return (
    <AutoRefresh interval={60000}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
          Resultados electorales
        </h1>

        {/* Cobertura */}
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Cobertura</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
              {tableCount} de {totalTables} mesas ({coverage}%)
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Total votos</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
              {totalVotes.toLocaleString('es-CO')}
            </div>
          </div>
        </div>

        {/* Tabla de resultados */}
        <div style={{
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflowX: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Candidato', 'Partido', 'Votos', '%', 'Progreso'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.candidateId} style={{ background: r.isOwn ? '#eff6ff' : undefined }}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: r.isOwn ? 700 : 400 }}>{r.candidateName}</span>
                      {r.isOwn && (
                        <span style={{
                          background: '#1e40af', color: '#fff',
                          padding: '0.1rem 0.35rem', borderRadius: '4px',
                          fontSize: '0.6rem', fontWeight: 700,
                        }}>
                          NUESTRO
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>
                    {r.party ?? '—'}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>
                    {r.totalVotes.toLocaleString('es-CO')}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: '#1e40af' }}>
                    {r.percentage}%
                  </td>
                  <td style={{ ...tdStyle, width: '200px' }}>
                    <div style={{
                      background: '#f1f5f9', borderRadius: '9999px', height: '12px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.min(r.percentage, 100)}%`,
                        height: '100%',
                        background: r.isOwn ? '#1e40af' : '#94a3b8',
                        borderRadius: '9999px',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                    No hay resultados aún
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AutoRefresh>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem', textAlign: 'left', fontSize: '0.75rem',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem', fontSize: '0.875rem', borderBottom: '1px solid #f1f5f9',
}
