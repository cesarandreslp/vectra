'use client'

import { useState } from 'react'
import type { TransmissionView, TransmissionDetail } from '../../actions'
import { getTransmissionStatus } from '../../actions'
import { DetalleTransmision } from './detalle-transmision'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  VERIFICADO:   { bg: '#dcfce7', text: '#166534' },
  INCOMPLETA:   { bg: '#fef3c7', text: '#92400e' },
  DISCREPANCIA: { bg: '#fee2e2', text: '#991b1b' },
  PENDIENTE:    { bg: '#f1f5f9', text: '#64748b' },
}

export function TablaTransmisiones({
  transmissions,
}: {
  transmissions: TransmissionView[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail]         = useState<TransmissionDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [filter, setFilter]         = useState<string>('')

  const filtered = filter
    ? transmissions.filter(t => t.verificationStatus === filter)
    : transmissions

  async function handleSelectRow(tx: TransmissionView) {
    if (selectedId === tx.id) {
      setSelectedId(null)
      setDetail(null)
      return
    }
    setSelectedId(tx.id)
    setLoadingDetail(true)
    const d = await getTransmissionStatus(tx.votingTableId)
    setDetail(d)
    setLoadingDetail(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <FilterBtn label="Todos" active={!filter} onClick={() => setFilter('')} />
        <FilterBtn label="Verificadas" active={filter === 'VERIFICADO'} onClick={() => setFilter('VERIFICADO')} />
        <FilterBtn label="En disputa" active={filter === 'DISCREPANCIA'} onClick={() => setFilter('DISCREPANCIA')} />
        <FilterBtn label="Incompletas" active={filter === 'INCOMPLETA'} onClick={() => setFilter('INCOMPLETA')} />
      </div>

      {/* Tabla */}
      <div style={{
        background: '#fff', borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflowX: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Mesa', 'Puesto', 'Testigo', 'Estado', 'Fuentes', 'Votos propios', 'Hora'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(tx => {
              const colors = STATUS_COLORS[tx.verificationStatus] ?? STATUS_COLORS.PENDIENTE
              return (
                <tr
                  key={tx.id}
                  onClick={() => handleSelectRow(tx)}
                  style={{ cursor: 'pointer', background: selectedId === tx.id ? '#f8fafc' : undefined }}
                >
                  <td style={tdStyle}>
                    {tx.tableNumber}
                    {/* El acta fotografiada dice ser de otra mesa: o el testigo
                        fotografió el papel equivocado, o hay algo peor. */}
                    {tx.actaCruzada && (
                      <span
                        title={`El acta fotografiada dice mesa ${tx.actaMesaNumero}, no ${tx.tableNumber}`}
                        style={{
                          marginLeft: '0.4rem', padding: '0.1rem 0.4rem', borderRadius: '9999px',
                          background: '#fee2e2', color: '#991b1b', fontSize: '0.65rem', fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        acta de la {tx.actaMesaNumero}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>{tx.stationName}</td>
                  <td style={{ ...tdStyle, fontSize: '0.8rem' }}>{tx.witnessEmail}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.15rem 0.5rem', borderRadius: '9999px',
                      fontSize: '0.7rem', fontWeight: 600,
                      background: colors.bg, color: colors.text,
                    }}>
                      {tx.verificationStatus}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <Fuente letra="M" titulo="Manual del testigo"      ok={tx.hasManual} />
                      <Fuente letra="F" titulo="Foto del acta (IA)"      ok={tx.hasPhoto} />
                      <Fuente letra="R" titulo="Publicado Registraduría" ok={tx.hasRegistraduria} />
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {tx.ownCandidateVotes ?? '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>
                    {tx.transmittedAt
                      ? new Date(tx.transmittedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  No hay transmisiones {filter ? 'con este estado' : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Panel de detalle */}
      {selectedId && (
        loadingDetail
          ? <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando detalle...</div>
          : detail && <DetalleTransmision detail={detail} onClose={() => { setSelectedId(null); setDetail(null) }} />
      )}
    </div>
  )
}

/** Chip de una de las tres fuentes obligatorias: gris = todavía no llegó. */
function Fuente({ letra, titulo, ok }: { letra: string; titulo: string; ok: boolean }) {
  return (
    <span
      title={`${titulo}${ok ? '' : ' — falta'}`}
      style={{
        width: '1.25rem', height: '1.25rem', borderRadius: '4px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.65rem', fontWeight: 700,
        background: ok ? '#dcfce7' : '#f1f5f9',
        color:      ok ? '#166534' : '#cbd5e1',
      }}
    >
      {letra}
    </span>
  )
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.3rem 0.7rem', fontSize: '0.75rem', borderRadius: '6px',
        border: `1px solid ${active ? '#1e40af' : '#cbd5e1'}`,
        background: active ? '#dbeafe' : '#fff',
        color: active ? '#1e40af' : '#64748b',
        cursor: 'pointer', fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9',
}
