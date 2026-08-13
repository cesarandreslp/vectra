'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { solicitarReset, restablecerPassword } from '../reset-actions'

const input: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1',
  borderRadius: '6px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
}
const boton: React.CSSProperties = {
  background: '#7d2839', color: '#fff', padding: '0.625rem 1rem', borderRadius: '6px',
  border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
}

function Caja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
      <div style={{ width: '100%', maxWidth: '380px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>{titulo}</h1>
        {children}
        <div style={{ marginTop: '1.25rem', fontSize: '0.8rem' }}>
          <Link href="/login" style={{ color: '#7d2839' }}>Volver al inicio de sesión</Link>
        </div>
      </div>
    </div>
  )
}

const aviso = (texto: string, ok: boolean) => (
  <div style={{ padding: '0.625rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b' }}>{texto}</div>
)

export function OlvideForm() {
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <Caja titulo="¿Olvidaste tu contraseña?">
      {mensaje ? aviso(mensaje, true) : (
        <form
          onSubmit={(e) => { e.preventDefault(); startTransition(async () => setMensaje((await solicitarReset(email)).message)) }}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Escribí tu correo y te mandamos un enlace para crear una contraseña nueva.</p>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="tu@correo.com" style={input} />
          <button type="submit" disabled={isPending} style={{ ...boton, background: isPending ? '#94a3b8' : boton.background }}>
            {isPending ? 'Enviando…' : 'Enviarme el enlace'}
          </button>
        </form>
      )}
    </Caja>
  )
}

export function RestablecerForm({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== repetir) { setError('Las contraseñas no coinciden.'); return }
    startTransition(async () => {
      const r = await restablecerPassword(token, password)
      if (!r.success) { setError(r.error ?? 'No se pudo restablecer.'); return }
      setListo(true)
      setTimeout(() => router.push('/login'), 2000)
    })
  }

  if (!token) return <Caja titulo="Enlace inválido">{aviso('Falta el token del enlace. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".', false)}</Caja>
  if (listo) return <Caja titulo="Contraseña actualizada">{aviso('Listo. Te llevamos al inicio de sesión…', true)}</Caja>

  return (
    <Caja titulo="Nueva contraseña">
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Nueva contraseña (mín. 8)" style={input} />
        <input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Repetila" style={input} />
        {error && aviso(error, false)}
        <button type="submit" disabled={isPending} style={{ ...boton, background: isPending ? '#94a3b8' : boton.background }}>
          {isPending ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </Caja>
  )
}
