'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { registrarDatosRegistraduria } from '../../actions'

/**
 * Carga manual de la tercera fuente: lo publicado por la Registraduría para esa
 * mesa. Se usa cuando el scraping no está disponible para la elección — sin
 * esta fuente la mesa nunca sale de INCOMPLETA.
 */
export function FormRegistraduria({
  votingTableId,
  filas,
}: {
  votingTableId: string
  filas: { id: string; label: string }[]
}) {
  const router = useRouter()
  const [votos, setVotos]   = useState<Record<string, string>>({})
  const [error, setError]   = useState<string | null>(null)
  const [pendiente, startTransition] = useTransition()

  function guardar() {
    setError(null)
    const datos = filas.map(f => ({ candidateId: f.id, votes: parseInt(votos[f.id] ?? '') || 0 }))
    startTransition(async () => {
      const r = await registrarDatosRegistraduria(votingTableId, datos, 'CARGA_MANUAL')
      if (!r.success) setError(r.error ?? 'No se pudo guardar.')
      else router.refresh()
    })
  }

  return (
    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.75rem' }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>
        CARGAR REGISTRADURÍA
      </div>

      {filas.map(f => (
        <div key={f.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '0.5rem', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0',
        }}>
          <span style={{ fontSize: '0.8rem', color: '#334155' }}>{f.label}</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={votos[f.id] ?? ''}
            onChange={e => setVotos({ ...votos, [f.id]: e.target.value })}
            style={{
              width: '5rem', padding: '0.2rem 0.4rem', fontSize: '0.8rem',
              border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'right',
            }}
          />
        </div>
      ))}

      {error && (
        <div style={{ color: '#991b1b', fontSize: '0.75rem', marginTop: '0.5rem' }}>{error}</div>
      )}

      <button
        onClick={guardar}
        disabled={pendiente}
        style={{
          marginTop: '0.75rem', padding: '0.4rem 0.9rem', fontSize: '0.8rem',
          borderRadius: '6px', border: '1px solid #1e40af',
          background: pendiente ? '#e2e8f0' : '#1e40af',
          color: pendiente ? '#64748b' : '#fff',
          cursor: pendiente ? 'default' : 'pointer', fontWeight: 600,
        }}
      >
        {pendiente ? 'Guardando…' : 'Guardar y verificar'}
      </button>
    </div>
  )
}
