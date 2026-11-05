'use client'

import { useEffect, useState, useTransition } from 'react'
import { aceptarAutorizacion, getAutorizacionPendiente } from '../autorizacion-actions'

/** Aviso para quien está en el padrón sin autorización de datos registrada. Desaparece al aceptar. */
export function AutorizacionPendiente() {
  const [aviso, setAviso] = useState<{ texto: string; politica: string } | null>(null)
  const [pendiente, iniciar] = useTransition()

  useEffect(() => {
    getAutorizacionPendiente().then(setAviso).catch(() => setAviso(null))
  }, [])

  if (!aviso) return null

  return (
    <div style={{
      background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px',
      padding: '0.875rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#78350f', lineHeight: 1.45,
    }}>
      <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Autorización de tus datos personales</div>
      <p style={{ margin: '0 0 0.6rem' }}>
        {aviso.texto}{' '}
        <a href={aviso.politica} target="_blank" rel="noopener noreferrer" style={{ color: '#92400e', fontWeight: 600 }}>Política y derechos</a>
      </p>
      <button
        type="button" disabled={pendiente}
        onClick={() => iniciar(async () => { if ((await aceptarAutorizacion()).success) setAviso(null) })}
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
