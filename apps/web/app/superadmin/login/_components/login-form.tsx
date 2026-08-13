'use client'

import { useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'

export function SuperadminLoginForm() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const resultado = await signIn('superadmin', { email, password, redirect: false })

      if (resultado?.error) {
        setError('Credenciales incorrectas.')
        return
      }

      // Navegación real: sin ella el gestor de contraseñas no ofrece guardar.
      window.location.assign('/superadmin')
    })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#5f1e2b' }}>
      <div style={{ width: '100%', maxWidth: '360px', background: '#fff', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.25)', borderTop: '4px solid #a8b054' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Vectra" style={{ height: '48px', width: 'auto', margin: '0 auto', display: 'block', objectFit: 'contain' }} />
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>Panel del SaaS — solo SUPERADMIN</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Correo electrónico</label>
            <input
              id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="username" placeholder="tu@vectra.com" style={estiloInput}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Contraseña</label>
            <input
              id="password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required autoComplete="current-password" style={estiloInput}
            />
          </div>

          {error && (
            <div style={{ padding: '0.625rem 0.75rem', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={isPending}
            style={{
              background: isPending ? '#94a3b8' : '#7d2839', color: '#fff', padding: '0.625rem 1rem',
              borderRadius: '6px', border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem', fontWeight: 600, marginTop: '0.25rem',
            }}
          >
            {isPending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const estiloInput: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1',
  borderRadius: '6px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
}
