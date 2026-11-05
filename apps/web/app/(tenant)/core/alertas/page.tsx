'use client'

import { useEffect, useState } from 'react'

interface Notificacion {
  id:        string
  type:      string
  message:   string
  metadata:  unknown
  createdAt: string
}

/** Solo rutas internas: el metadata lo escribe el servidor, pero un enlace externo acá sería phishing. */
function enlace(metadata: unknown): string | null {
  const href = (metadata as { href?: unknown } | null)?.href
  return typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') ? href : null
}

/**
 * Alertas del usuario (notificaciones no leídas). Reusa /api/notificaciones,
 * la misma fuente que el badge del sidebar. El nav ya enlazaba aquí; sin esta
 * página el enlace daba 404.
 */
export default function AlertasPage() {
  const [items, setItems]   = useState<Notificacion[] | null>(null)
  const [error, setError]   = useState(false)

  useEffect(() => {
    fetch('/api/notificaciones', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setItems(d.notificaciones ?? []))
      .catch(() => setError(true))
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Alertas</h1>

      {error && <p style={{ color: '#991b1b' }}>No se pudieron cargar las alertas.</p>}
      {!error && items === null && <p style={{ color: '#64748b' }}>Cargando…</p>}
      {!error && items?.length === 0 && (
        <p style={{ color: '#64748b' }}>No tienes alertas pendientes.</p>
      )}

      {items && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map((n) => (
            <div
              key={n.id}
              style={{
                background:   '#fff',
                border:       '1px solid #e2e8f0',
                borderLeft:   '4px solid #ef4444',
                borderRadius: '8px',
                padding:      '1rem 1.25rem',
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {n.type.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#0f172a', margin: '0.35rem 0' }}>{n.message}</div>
              {enlace(n.metadata) && (
                <a href={enlace(n.metadata)!} style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1d4ed8' }}>Abrir →</a>
              )}
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {new Date(n.createdAt).toLocaleString('es-CO')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
