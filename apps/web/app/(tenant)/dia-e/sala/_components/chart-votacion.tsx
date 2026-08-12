'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import type { ElectionResultView } from '../../actions'

/**
 * Votación en vivo — sube con cada mesa que transmite el testigo.
 * Barras horizontales para que quepan nombres largos de candidatos.
 */
export function ChartVotacion({ resultados }: { resultados: ElectionResultView[] }) {
  const data = [...resultados]
    .filter(r => r.totalVotes > 0)
    .sort((a, b) => b.totalVotes - a.totalVotes)

  const totalVotos = data.reduce((s, r) => s + r.totalVotes, 0)
  const mesas      = resultados[0]?.tableCount ?? 0
  const totalMesas = resultados[0]?.totalTables ?? 0

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#334155' }}>
          Votación en vivo
        </h3>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
          {mesas} de {totalMesas} mesas · {totalVotos.toLocaleString('es-CO')} votos
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
          Todavía no hay mesas transmitidas
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 42)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="candidateName"
              width={140}
              tick={{ fontSize: 11, fill: '#334155' }}
            />
            <Tooltip formatter={v => [`${Number(v).toLocaleString('es-CO')} votos`, 'Votos']} />
            <Bar dataKey="totalVotes" radius={[0, 4, 4, 0]}>
              {data.map(r => (
                <Cell key={r.candidateId} fill={r.isOwn ? '#1e40af' : '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
