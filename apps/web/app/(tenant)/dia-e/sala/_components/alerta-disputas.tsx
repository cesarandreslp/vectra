import type { MesaEnDisputa } from '../../actions'

const ETIQUETA_FUENTE: Record<string, string> = {
  MANUAL:        'Manual',
  FOTO:          'Foto (IA)',
  REGISTRADURIA: 'Registraduría',
}

/**
 * Mesas donde las fuentes no cuadran. Son las candidatas a demanda: se muestran
 * arriba y con el detalle de qué dijo cada fuente, que es lo que hay que anexar
 * a la reclamación.
 */
export function AlertaDisputas({ mesas }: { mesas: MesaEnDisputa[] }) {
  if (mesas.length === 0) return null

  return (
    <div style={{
      background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '12px',
      padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
    }}>
      <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.95rem' }}>
        {mesas.length} mesa(s) con fuentes que no coinciden — candidatas a demanda
      </div>

      {mesas.map(m => (
        <div key={m.votingTableId} style={{
          background: '#fff', borderRadius: '8px', padding: '0.75rem',
          fontSize: '0.8rem', overflowX: 'auto',
        }}>
          <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.4rem' }}>
            Mesa {m.tableNumber} — {m.stationName}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Candidato', 'Manual', 'Foto (IA)', 'Registraduría', 'Diferencia'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', fontSize: '0.7rem', color: '#64748b',
                    borderBottom: '1px solid #e2e8f0', padding: '0.25rem 0.5rem', whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.discrepancias.map(d => (
                <tr key={d.candidateId}>
                  <td style={celda}>{d.candidateName}</td>
                  {['MANUAL', 'FOTO', 'REGISTRADURIA'].map(f => (
                    <td key={f} style={celda} title={ETIQUETA_FUENTE[f]}>
                      {d.valores[f] ?? '—'}
                    </td>
                  ))}
                  <td style={{ ...celda, fontWeight: 700, color: '#991b1b' }}>
                    {d.diferencia}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

const celda: React.CSSProperties = {
  padding: '0.25rem 0.5rem', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap',
}
