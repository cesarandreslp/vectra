'use client'

import type { TransmissionDetail } from '../../actions'
import { FormRegistraduria } from './form-registraduria'

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  VERIFICADO:   { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  INCOMPLETA:   { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  DISCREPANCIA: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  PENDIENTE:    { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
}

export function DetalleTransmision({
  detail: d,
  onClose,
}: {
  detail: TransmissionDetail
  onClose: () => void
}) {
  const colors = STATUS_COLORS[d.verificationStatus] ?? STATUS_COLORS.PENDIENTE

  // El acta trae candidatos + blanco/nulos; el nombre sale del catálogo y, si no
  // está (la IA devuelve el nombre leído de la foto), se muestra tal cual vino.
  const nombres = new Map(d.candidatos.map(c => [c.id.toLowerCase(), c.name]))
  const etiqueta = (id: string) =>
    nombres.get(id.toLowerCase())
      ?? (id === 'votos_blanco' ? 'Votos en blanco' : id === 'votos_nulos' ? 'Votos nulos' : id)

  // Filas a cargar para la Registraduría: las mismas que reportó el testigo.
  const filas = (d.manualData ?? d.extractedData ?? d.candidatos.map(c => ({ candidateId: c.id, votes: 0 })))
    .map(v => ({ id: v.candidateId, label: etiqueta(v.candidateId) }))

  return (
    <div style={{
      background: '#fff', borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      border: `2px solid ${colors.border}`,
      padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>
            Mesa {d.tableNumber} — {d.stationName}
          </h3>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            Testigo: {d.witnessEmail}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{
            padding: '0.2rem 0.6rem', borderRadius: '9999px',
            fontSize: '0.75rem', fontWeight: 600,
            background: colors.bg, color: colors.text,
          }}>
            {d.verificationStatus}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '1.2rem',
            cursor: 'pointer', color: '#94a3b8',
          }}>
            &times;
          </button>
        </div>
      </div>

      {/* Las tres fuentes, lado a lado */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem',
      }}>
        <Fuente
          titulo="MANUAL DEL TESTIGO"
          hora={d.manualSubmittedAt}
          data={d.manualData} total={d.manualTotal} etiqueta={etiqueta}
        />
        <Fuente
          titulo="FOTO DEL ACTA (IA)"
          hora={d.photoSubmittedAt}
          extra={d.extractionConfidence ?? undefined}
          data={d.extractedData} total={d.extractedTotal} etiqueta={etiqueta}
        />
        {d.registraduriaData ? (
          <Fuente
            titulo="REGISTRADURÍA"
            hora={d.registraduriaAt}
            extra={d.registraduriaFuente ?? undefined}
            data={d.registraduriaData} total={d.registraduriaTotal} etiqueta={etiqueta}
          />
        ) : (
          <FormRegistraduria votingTableId={d.votingTableId} filas={filas} />
        )}
      </div>

      {/* Discrepancias entre fuentes */}
      {d.discrepancias && d.discrepancias.length > 0 && (
        <div style={{
          background: '#fee2e2', borderRadius: '8px', padding: '0.75rem',
          fontSize: '0.8rem', color: '#991b1b',
        }}>
          <strong>Las fuentes no coinciden — mesa candidata a demanda:</strong>
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
            {d.discrepancias.map(x => (
              <li key={x.candidateId}>
                {etiqueta(x.candidateId)}:{' '}
                {Object.entries(x.valores).map(([f, v]) => `${f} ${v}`).join(' · ')}
                {' '}(dif. {x.diferencia})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Foto */}
      {d.photoUrl && (
        <div>
          <a
            href={d.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '0.4rem 0.9rem', fontSize: '0.8rem', borderRadius: '6px',
              border: '1px solid #1e40af', background: '#fff', color: '#1e40af',
              textDecoration: 'none', fontWeight: 500,
            }}
          >
            Ver foto original
          </a>
        </div>
      )}

      {/* Notas */}
      {d.notes && (
        <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
          Notas: {d.notes}
        </div>
      )}
    </div>
  )
}

function Fuente({ titulo, hora, extra, data, total, etiqueta }: {
  titulo: string
  hora: Date | null
  extra?: string
  data: { candidateId: string; votes: number }[] | null
  total: number | null
  etiqueta: (id: string) => string
}) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>
        {titulo}
        {extra && (
          <span style={{
            marginLeft: '0.4rem', padding: '0.1rem 0.3rem', borderRadius: '4px',
            fontSize: '0.65rem', background: '#e2e8f0', color: '#475569',
          }}>
            {extra}
          </span>
        )}
        {hora && (
          <span style={{ fontWeight: 400, marginLeft: '0.4rem' }}>
            {new Date(hora).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {data ? (
        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem' }}>
          {data.map((v, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0',
            }}>
              <span style={{ color: '#334155' }}>{etiqueta(v.candidateId)}</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{v.votes}</span>
            </div>
          ))}
          {total !== null && (
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '0.4rem 0 0', fontWeight: 700, color: '#0f172a',
            }}>
              <span>Total</span>
              <span>{total}</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: '#f8fafc', borderRadius: '8px', padding: '0.75rem',
          fontSize: '0.8rem', color: '#94a3b8',
        }}>
          Falta esta fuente.
        </div>
      )}
    </div>
  )
}
