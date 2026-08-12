import Link from 'next/link'
import { getLeaderRanking } from '../../actions'
import { TitulosLider } from '../_components/titulos-lider'

export const metadata = { title: 'Ranking de líderes' }

/** Ranking completo de captadores (HALLAZGO 9) — todo el sub-árbol de cada líder, a cualquier nivel. */
export default async function RankingLideresPage() {
  const ranking = await getLeaderRanking()

  return (
    <div style={{ maxWidth: '700px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
        <Link href="/core" style={{ fontSize: '0.85rem', color: '#1e40af', textDecoration: 'none' }}>← Dashboard</Link>
      </div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>Ranking de líderes</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Ordenado por electores en todo el sub-árbol (directos + sub-líderes), no solo followers directos.
      </p>

      {ranking.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Todavía no hay líderes con electores propios.</p>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          {ranking.map((l, i) => (
            <Link
              key={l.id} href={`/core/lideres/${l.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.25rem',
                textDecoration: 'none', color: 'inherit',
                borderTop: i === 0 ? 'none' : '1px solid #f1f5f9',
              }}
            >
              <span style={{ fontWeight: 700, color: '#94a3b8', width: '2rem' }}>#{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{l.name}</span>
                  <TitulosLider titulos={l.titulos} />
                </div>
                {l.zone && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{l.zone}</div>}
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>{l.totalDownline}</div>
                <div>{l.directos} directos · {l.comprometidosDownline} comprometidos{l.profundidad > 0 ? ` · ${l.profundidad} nivel(es)` : ''}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
