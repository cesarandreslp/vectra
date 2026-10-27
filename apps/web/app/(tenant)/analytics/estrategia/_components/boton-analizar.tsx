'use client'

import { useState, useTransition } from 'react'
import { analizarAhora } from '../actions'

/** Corre el análisis de esta semana sin esperar al lunes. */
export function BotonAnalizar({ deshabilitado, yaCorrio }: { deshabilitado: boolean; yaCorrio: boolean }) {
  const [pendiente, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  function analizar() {
    setMsg(null)
    startTransition(async () => {
      const r = await analizarAhora()
      setMsg({ ok: r.ok, texto: r.mensaje })
    })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      {msg && <span style={{ fontSize: '0.8rem', color: msg.ok ? '#166534' : '#b91c1c' }}>{msg.texto}</span>}
      <button
        type="button" onClick={analizar} disabled={deshabilitado || pendiente}
        title={yaCorrio ? 'El análisis de esta semana ya se hizo' : undefined}
        style={{
          border: 'none', borderRadius: 8, padding: '0.5rem 0.9rem', fontSize: '0.85rem', fontWeight: 600,
          background: deshabilitado || pendiente ? '#cbd5e1' : '#0f172a', color: '#fff',
          cursor: deshabilitado || pendiente ? 'not-allowed' : 'pointer',
        }}
      >
        {pendiente ? 'Analizando… (1 a 3 min)' : 'Analizar ahora'}
      </button>
    </div>
  )
}
