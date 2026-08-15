'use client'

import { useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { textoSobre } from '@/lib/brand-contrast'

interface Props {
  slug:         string
  tenantName:   string | null
  logoUrl:      string | null
  primaryColor: string | null
}

export function LoginElectorForm({ slug, tenantName, logoUrl, primaryColor }: Props) {
  const [cedula,   setCedula]   = useState('')
  const [telefono, setTelefono] = useState('')
  const [error,    setError]    = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!slug) {
      setError('Falta el enlace de tu campaña — pide que te compartan el link correcto.')
      return
    }

    startTransition(async () => {
      const resultado = await signIn('elector', { slug, cedula, telefono, redirect: false })

      if (resultado?.error) {
        setError('No encontramos una cuenta con esa cédula y teléfono.')
        return
      }

      router.push('/pwa')
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
            Entra con tu cédula y tu teléfono
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="cedula" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Cédula
            </label>
            <input
              id="cedula" type="text" inputMode="numeric" value={cedula}
              onChange={e => setCedula(e.target.value)}
              required autoComplete="off" placeholder="12345678"
              style={estiloInput}
            />
          </div>

          <div>
            <label htmlFor="telefono" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Teléfono
            </label>
            <input
              id="telefono" type="tel" inputMode="tel" value={telefono}
              onChange={e => setTelefono(e.target.value)}
              required autoComplete="off" placeholder="300 000 0000"
              style={estiloInput}
            />
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px' }}>
              El mismo que quedó registrado cuando te inscribiste.
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.625rem 0.75rem', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '0.875rem' }}>
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
            {isPending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <a href={`/testigo/login?c=${slug}`}
          style={{ display: 'block', textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#64748b', textDecoration: 'none' }}>
          ¿Sos testigo? Entra por el acceso de testigos →
        </a>
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
