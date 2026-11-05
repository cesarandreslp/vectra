'use client'

import { useState, useTransition } from 'react'
import { cambiarMiClave } from '@/app/_actions/mi-clave'

/** Cambiar la contraseña de la propia cuenta. */
export function CambiarClave() {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, iniciar] = useTransition()

  const caja: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 6, padding: '0.55rem 0.75rem', fontSize: '0.9rem', width: '100%', maxWidth: 320 }
  const etiqueta: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#475569' }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (nueva !== repetida) { setMensaje({ ok: false, texto: 'Las dos contraseñas nuevas no coinciden.' }); return }
    iniciar(async () => {
      const r = await cambiarMiClave(actual, nueva)
      if (r.success) { setActual(''); setNueva(''); setRepetida('') }
      setMensaje(r.success ? { ok: true, texto: 'Listo: la contraseña quedó cambiada.' } : { ok: false, texto: r.error })
    })
  }

  return (
    <form onSubmit={enviar} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 520 }}>
      <div style={{ fontWeight: 700 }}>Cambiar contraseña</div>
      <label style={etiqueta}>Contraseña actual
        <input type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} style={caja} />
      </label>
      <label style={etiqueta}>Contraseña nueva (mínimo 10 caracteres)
        <input type="password" autoComplete="new-password" required minLength={10} value={nueva} onChange={(e) => setNueva(e.target.value)} style={caja} />
      </label>
      <label style={etiqueta}>Repite la contraseña nueva
        <input type="password" autoComplete="new-password" required minLength={10} value={repetida} onChange={(e) => setRepetida(e.target.value)} style={caja} />
      </label>
      <button type="submit" disabled={pendiente}
        style={{ alignSelf: 'flex-start', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '0.55rem 1rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', opacity: pendiente ? 0.6 : 1 }}>
        {pendiente ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
      {mensaje && <p style={{ margin: 0, fontSize: '0.85rem', color: mensaje.ok ? '#166534' : '#b91c1c' }}>{mensaje.texto}</p>}
    </form>
  )
}
