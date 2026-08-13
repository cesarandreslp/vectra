'use client'

import { useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { textoSobre } from '@/lib/brand-contrast'

interface LoginFormProps {
  /** URL a la que volver tras login exitoso (la setea el middleware en redirects) */
  callbackUrl?:  string
  /** Branding de campaña (?c=slug) — solo cosmético, null = branding Vectra por defecto (SUPERADMIN). */
  tenantName?:   string | null
  logoUrl?:      string | null
  primaryColor?: string | null
}

export function LoginForm({ callbackUrl, tenantName, logoUrl, primaryColor }: LoginFormProps) {
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [showPassword,  setShowPassword]  = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const resultado = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (resultado?.error) {
        setError('Credenciales incorrectas. Verifica tu email y contraseña.')
        return
      }

      // El destino se decide en /login mismo (página server) según la sesión.
      // Si hay callbackUrl, vamos directo allá; si no, /login server-side
      // redirige según el rol.
      router.push(callbackUrl ?? '/login')
      router.refresh()
    })
  }

  return (
    <div
      style={{
        minHeight:      '100vh',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     '#f1f5f9',
      }}
    >
      <div
        style={{
          width:        '100%',
          maxWidth:     '380px',
          background:   '#fff',
          borderRadius: '12px',
          border:       '1px solid #e2e8f0',
          padding:      '2rem',
          boxShadow:    '0 4px 24px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl ?? '/logo.png'}
            alt={tenantName ?? 'Vectra'}
            style={{ height: '52px', width: 'auto', margin: '0 auto', display: 'block', objectFit: 'contain' }}
          />
          {tenantName && (
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '0.5rem' }}>
              {tenantName}
            </div>
          )}
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: tenantName ? '0.15rem' : '0.5rem' }}>
            {tenantName ? 'Acceso del equipo de campaña' : 'Dirección estratégica para campañas electorales'}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div>
            <label
              htmlFor="email"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}
            >
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tu@correo.com"
              style={estiloInput}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}
            >
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ ...estiloInput, paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
                tabIndex={-1}
                style={{
                  position:        'absolute',
                  top:             '50%',
                  right:           '0.5rem',
                  transform:       'translateY(-50%)',
                  background:      'transparent',
                  border:          'none',
                  cursor:          'pointer',
                  padding:         '0.25rem',
                  color:           '#64748b',
                  display:         'inline-flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                }}
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding:      '0.625rem 0.75rem',
                borderRadius: '6px',
                background:   '#fee2e2',
                color:        '#991b1b',
                fontSize:     '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            style={{
              background:   isPending ? '#94a3b8' : (primaryColor || '#7d2839'),
              // Blanco fijo se pierde sobre una marca clara — se decide contra el fondo real.
              color:        textoSobre(isPending ? '#94a3b8' : (primaryColor || '#7d2839')),
              padding:      '0.625rem 1rem',
              borderRadius: '6px',
              border:       'none',
              cursor:       isPending ? 'not-allowed' : 'pointer',
              fontSize:     '0.875rem',
              fontWeight:   600,
              marginTop:    '0.25rem',
            }}
          >
            {isPending ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <a href="/login/olvide" style={{ fontSize: '0.8rem', color: '#64748b' }}>
            ¿Olvidaste tu contraseña?
          </a>
        </div>
      </div>
    </div>
  )
}

const estiloInput: React.CSSProperties = {
  width:        '100%',
  padding:      '0.5rem 0.75rem',
  border:       '1px solid #cbd5e1',
  borderRadius: '6px',
  fontSize:     '0.875rem',
  outline:      'none',
  boxSizing:    'border-box',
}

function IconEye() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1={2} y1={2} x2={22} y2={22} />
    </svg>
  )
}
