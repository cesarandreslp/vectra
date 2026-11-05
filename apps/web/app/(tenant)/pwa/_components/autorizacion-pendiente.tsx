'use client'

import { useEffect, useState, useTransition } from 'react'
import { aceptarAutorizacion, getAutorizacionPendiente } from '../autorizacion-actions'

/** Aviso para quien está en el padrón sin autorización de datos registrada. Desaparece al aceptar. */
export function AutorizacionPendiente() {
  const [texto, setTexto] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  useEffect(() => {
    getAutorizacionPendiente().then(setTexto).catch(() => setTexto(null))
  }, [])

  if (!texto) return null

  return (
    <div style={{
      background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px',
      padding: '0.875rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#78350f', lineHeight: 1.45,
    }}>
      <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Autorización de tus datos personales</div>
      <p style={{ margin: '0 0 0.6rem' }}>{texto}</p>
      <button
        type="button" disabled={pendiente}
        onClick={() => iniciar(async () => { if ((await aceptarAutorizacion()).success) setTexto(null) })}
        style={{
          background: '#92400e', color: '#fff', border: 'none', borderRadius: '8px',
          padding: '0.5rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', opacity: pendiente ? 0.6 : 1,
        }}
      >
        Acepto
      </button>
    </div>
  )
}
