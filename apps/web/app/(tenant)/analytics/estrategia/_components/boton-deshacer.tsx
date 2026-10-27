'use client'

import { useState, useTransition } from 'react'
import { deshacerCorrectivo } from '../actions'

export function BotonDeshacer({ id }: { id: string }) {
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function deshacer() {
    if (!confirm('¿Deshacer este correctivo y volver al valor anterior?')) return
    startTransition(async () => {
      const r = await deshacerCorrectivo(id)
      setError(r.ok ? null : r.mensaje)
    })
  }

  return (
    <>
      <button
        type="button" onClick={deshacer} disabled={pendiente}
        style={{ marginLeft: 8, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', color: '#475569', fontSize: '0.75rem', padding: '0.15rem 0.45rem', cursor: 'pointer' }}
      >
        {pendiente ? '…' : 'Deshacer'}
      </button>
      {error && <div style={{ fontSize: '0.72rem', color: '#b91c1c', whiteSpace: 'normal', maxWidth: 220 }}>{error}</div>}
    </>
  )
}
