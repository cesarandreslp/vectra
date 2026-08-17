'use client'

import { useState } from 'react'
import { submitManualE14 } from '../../actions'
import type { CandidateView } from '../../actions'
import { validarNivelacion, tituloActa } from '@/lib/e14'

interface VoteEntry {
  candidateId: string
  votes: number
}

/**
 * Réplica del formulario E-14 físico de la Registraduría (ver docs/e14.webp):
 * encabezado con el cargo, bloque de ubicación con códigos DIVIPOLA, bloque
 * "NIVELACIÓN DE LA MESA" y el tarjetón numerado con foto y agrupación.
 * La fidelidad importa: el testigo transcribe mirando el papel, y cualquier
 * diferencia de orden o de columnas lo hace equivocarse de renglón.
 */
export function FormManualE14({
  votingTableId,
  tableNumber,
  stationName,
  zonaCode,
  municipality,
  department,
  departmentCode,
  municipalityDivipola,
  cargo,
  candidates,
  extractedData,
  onTransmitted,
  onBack,
}: {
  votingTableId: string
  tableNumber: number
  stationName: string
  zonaCode: string | null
  municipality: string
  department: string
  departmentCode: string
  municipalityDivipola: string
  cargo: string | null
  candidates: CandidateView[]
  extractedData: VoteEntry[] | null
  extractedConfidence: string | null
  onTransmitted: () => void
  onBack: () => void
}) {
  const allEntries = [...candidates.map(c => c.id), 'VOTOS_BLANCO', 'VOTOS_NULOS']

  const extractedMap = new Map<string, number>()
  if (extractedData) {
    for (const e of extractedData) {
      extractedMap.set(e.candidateId.toLowerCase(), e.votes)
      const match = candidates.find(c => c.name.toLowerCase() === e.candidateId.toLowerCase())
      if (match) extractedMap.set(match.id, e.votes)
    }
    for (const e of extractedData) {
      const lower = e.candidateId.toLowerCase()
      if (lower.includes('blanco')) extractedMap.set('VOTOS_BLANCO', e.votes)
      if (lower.includes('nulo'))   extractedMap.set('VOTOS_NULOS', e.votes)
    }
  }

  const [votes, setVotes] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const id of allEntries) initial[id] = extractedMap.get(id) ?? 0
    return initial
  })

  // Bloque NIVELACIÓN DE LA MESA
  const [e11, setE11]                 = useState<number>(0)
  const [urna, setUrna]               = useState<number>(0)
  const [incinerados, setIncinerados] = useState<number>(0)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentSum = Object.values(votes).reduce((a, b) => a + b, 0)
  const chequeo    = validarNivelacion(currentSum, { e11, urna, incinerados })
  const hasExtracted = Boolean(extractedData && extractedData.length > 0)

  function updateVote(id: string, value: number) {
    setVotes(prev => ({ ...prev, [id]: Math.max(0, value) }))
  }

  let submitLabel = 'Transmitir — Solo manual'
  let submitBg    = '#fbbf24'
  let submitColor = '#000'
  if (hasExtracted) {
    const hayDiscrepancia = extractedData!.some(e => {
      const match = candidates.find(c => c.name.toLowerCase() === e.candidateId.toLowerCase())
      const manualVal = match ? votes[match.id] : undefined
      return manualVal !== undefined && manualVal !== e.votes
    })
    submitLabel = hayDiscrepancia ? 'Transmitir — Con advertencia' : 'Transmitir — Verificado'
    submitBg    = hayDiscrepancia ? '#ef4444' : '#16a34a'
    submitColor = '#fff'
  }

  async function handleSubmit() {
    if (!chequeo.ok) return
    setSubmitting(true)
    setError(null)

    const voteEntries: VoteEntry[] = Object.entries(votes).map(([candidateId, v]) => ({ candidateId, votes: v }))
    const result = await submitManualE14(votingTableId, voteEntries, urna, { e11, urna, incinerados })

    setSubmitting(false)
    if (result.success) onTransmitted()
    else setError(result.error ?? 'Error al transmitir.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', border: '2px solid #000', borderRadius: '4px', overflow: 'hidden', background: '#fff' }}>
      {/* ── Encabezado: cargo en grande, como el acta física ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderBottom: '2px solid #000', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.55rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          FORMULARIO<br />E-14
        </div>
        <div style={{ fontSize: '1.35rem', fontWeight: 900, letterSpacing: '0.05em' }}>
          {tituloActa(cargo)}
        </div>
        <div style={{ fontSize: '0.5rem', fontWeight: 700, textAlign: 'right', lineHeight: 1.1 }}>
          REGISTRADURÍA<br />NACIONAL DEL<br />ESTADO CIVIL
        </div>
      </div>

      {/* ── Ubicación con códigos DIVIPOLA ── */}
      <div style={{ border: '1.5px solid #000', margin: '0.5rem', padding: '0.4rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.6 }}>
        <div>DEPARTAMENTO: <strong>{departmentCode} - {department.toUpperCase()}</strong></div>
        <div>MUNICIPIO: <strong>{municipalityDivipola} - {municipality.toUpperCase()}</strong></div>
        <div>ZONA: <strong>{zonaCode ?? '—'}</strong></div>
        <div>PUESTO: <strong>{stationName.toUpperCase()}</strong></div>
        <div>MESA: <strong>{String(tableNumber).padStart(3, '0')}</strong></div>
      </div>

      {/* ── NIVELACIÓN DE LA MESA ── */}
      <div style={{ margin: '0 0.5rem' }}>
        <div style={{ background: '#000', color: '#fff', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', padding: '0.3rem', letterSpacing: '0.05em' }}>
          NIVELACIÓN DE LA MESA
        </div>
        <FilaNivelacion label="TOTAL VOTANTES FORMULARIO E-11" value={e11} onChange={setE11} />
        <FilaNivelacion label={`TOTAL VOTOS DE ${tituloActa(cargo)} EN LA URNA`} value={urna} onChange={setUrna} />
        <FilaNivelacion label="TOTAL VOTOS INCINERADOS" value={incinerados} onChange={setIncinerados} ultima />
      </div>

      {/* ── Tarjetón: Nº | AGRUPACIÓN | CANDIDATO | VOTACIÓN ── */}
      <div style={{ margin: '0.75rem 0.5rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 76px', background: '#000', color: '#fff', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.04em' }}>
          <div style={{ padding: '0.3rem 0.2rem', textAlign: 'center' }}>Nº</div>
          <div style={{ padding: '0.3rem 0.4rem' }}>AGRUPACIÓN Y CANDIDATO</div>
          <div style={{ padding: '0.3rem 0.2rem', textAlign: 'center' }}>VOTACIÓN</div>
        </div>

        {candidates.map(c => {
          const extractedVal = extractedMap.get(c.id)
          const hasDiff = extractedVal !== undefined && extractedVal !== votes[c.id]
          return (
            <div
              key={c.id}
              style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 76px', alignItems: 'center',
                border: '1.5px solid #000', borderTop: 'none',
                background: c.isOwn ? '#eff6ff' : '#fff',
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', borderRight: '1.5px solid #000', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.order}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.4rem', minWidth: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.photoUrl
                  ? <img src={c.photoUrl} alt="" style={{ width: '34px', height: '40px', objectFit: 'cover', border: '1px solid #000', flexShrink: 0 }} />
                  : <div style={{ width: '34px', height: '40px', border: '1px dashed #94a3b8', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1 }}>sin<br />foto</div>}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.partyLogoUrl && <img src={c.partyLogoUrl} alt="" style={{ height: '16px', width: 'auto', maxWidth: '48px', objectFit: 'contain', flexShrink: 0 }} />}
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.party ?? 'Sin agrupación'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: c.isOwn ? 700 : 500, lineHeight: 1.2 }}>
                    {c.name.toUpperCase()}
                  </div>
                  {c.isOwn && (
                    <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#1e40af' }}>NUESTRO CANDIDATO</span>
                  )}
                </div>
              </div>

              <CasillaVoto
                value={votes[c.id]}
                onChange={v => updateVote(c.id, v)}
                extracted={extractedVal}
                hasDiff={hasDiff}
              />
            </div>
          )
        })}

        <FilaEspecial id="VOTOS_BLANCO" label="VOTOS EN BLANCO" votes={votes} extractedMap={extractedMap} onChange={updateVote} />
        <FilaEspecial id="VOTOS_NULOS"  label="VOTOS NULOS"     votes={votes} extractedMap={extractedMap} onChange={updateVote} />
      </div>

      {/* ── Validación y transmisión ── */}
      <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
          <span>Suma de votos digitados:</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>{currentSum}</span>
        </div>

        {chequeo.errores.map((e, i) => (
          <div key={i} style={{ background: '#fee2e2', color: '#991b1b', padding: '0.5rem 0.7rem', borderRadius: '6px', fontSize: '0.78rem' }}>{e}</div>
        ))}
        {chequeo.avisos.map((a, i) => (
          <div key={i} style={{ background: '#fef3c7', color: '#92400e', padding: '0.5rem 0.7rem', borderRadius: '6px', fontSize: '0.78rem' }}>{a}</div>
        ))}
        {chequeo.ok && chequeo.avisos.length === 0 && (
          <div style={{ background: '#dcfce7', color: '#166534', padding: '0.5rem 0.7rem', borderRadius: '6px', fontSize: '0.78rem' }}>
            El acta cuadra. Puedes transmitir.
          </div>
        )}
        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.5rem 0.7rem', borderRadius: '6px', fontSize: '0.78rem' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onBack} style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer' }}>
            Volver
          </button>
          <button
            onClick={handleSubmit}
            disabled={!chequeo.ok || submitting}
            style={{
              flex: 2, padding: '0.75rem', fontSize: '0.875rem', borderRadius: '8px', border: 'none',
              background: chequeo.ok ? submitBg : '#94a3b8', color: chequeo.ok ? submitColor : '#fff',
              cursor: chequeo.ok && !submitting ? 'pointer' : 'not-allowed', fontWeight: 700,
            }}
          >
            {submitting ? 'Transmitiendo...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function FilaNivelacion({ label, value, onChange, ultima }: {
  label: string; value: number; onChange: (v: number) => void; ultima?: boolean
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 76px', alignItems: 'center',
      border: '1.5px solid #000', borderTop: 'none',
      ...(ultima ? {} : {}),
    }}>
      <div style={{ padding: '0.4rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, borderRight: '1.5px solid #000' }}>
        {label}
      </div>
      <input
        type="number" min="0" inputMode="numeric"
        value={value || ''}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        style={estiloCasilla}
      />
    </div>
  )
}

function CasillaVoto({ value, onChange, extracted, hasDiff }: {
  value: number; onChange: (v: number) => void; extracted?: number; hasDiff?: boolean
}) {
  return (
    <div style={{ borderLeft: '1.5px solid #000', alignSelf: 'stretch', display: 'flex', flexDirection: 'column' }}>
      <input
        type="number" min="0" inputMode="numeric"
        value={value || ''}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        style={{ ...estiloCasilla, border: 'none', flex: 1 }}
      />
      {extracted !== undefined && (
        <div style={{ fontSize: '0.55rem', textAlign: 'center', paddingBottom: '2px', color: hasDiff ? '#ef4444' : '#16a34a', fontWeight: 700 }}>
          IA: {extracted}
        </div>
      )}
    </div>
  )
}

function FilaEspecial({ id, label, votes, extractedMap, onChange }: {
  id: string; label: string; votes: Record<string, number>
  extractedMap: Map<string, number>; onChange: (id: string, v: number) => void
}) {
  const extractedVal = extractedMap.get(id)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 76px', alignItems: 'center', border: '1.5px solid #000', borderTop: 'none', background: '#f8fafc' }}>
      <div style={{ borderRight: '1.5px solid #000', alignSelf: 'stretch' }} />
      <div style={{ padding: '0.5rem 0.4rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em' }}>{label}</div>
      <CasillaVoto
        value={votes[id]}
        onChange={v => onChange(id, v)}
        extracted={extractedVal}
        hasDiff={extractedVal !== undefined && extractedVal !== votes[id]}
      />
    </div>
  )
}

const estiloCasilla: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.2rem', fontSize: '1.15rem', fontWeight: 700,
  textAlign: 'center', border: 'none', outline: 'none',
  fontFamily: 'ui-monospace, monospace', letterSpacing: '0.15em',
  background: 'transparent', boxSizing: 'border-box',
}
