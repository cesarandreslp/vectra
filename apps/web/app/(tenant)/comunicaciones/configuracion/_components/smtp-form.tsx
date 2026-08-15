'use client'

import { useState } from 'react'
import { updateSmtpConfig, testSmtpConnection } from '../../actions'
import type { SmtpConfigView } from '../../actions'

export function SmtpForm({ initial }: { initial: SmtpConfigView | null }) {
  const [host, setHost] = useState(initial?.host ?? '')
  const [port, setPort] = useState(initial?.port ?? 587)
  const [secure, setSecure] = useState(initial?.secure ?? false)
  const [user, setUser] = useState(initial?.user ?? '')
  const [password, setPassword] = useState('')
  const [from, setFrom] = useState(initial?.from ?? '')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  async function handleSave() {
    if (!host.trim() || !user.trim() || !from.trim()) {
      setError('Completa host, usuario y email remitente')
      return
    }
    if (!initial && !password) {
      setError('El password es obligatorio para la primera configuración')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateSmtpConfig({
        host,
        port,
        secure,
        user,
        password: password || undefined,
        from,
      })
      setSaved(true)
      setPassword('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!testEmail.trim()) {
      setTestResult({ success: false, error: 'Ingresa un email de destino' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testSmtpConnection(testEmail)
      setTestResult(result)
    } catch (e) {
      setTestResult({ success: false, error: e instanceof Error ? e.message : 'Error' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Formulario de configuración */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>
        {error && (
          <div style={{
            padding: '0.75rem', background: '#fee2e2', color: '#991b1b',
            borderRadius: '8px', fontSize: '0.85rem',
          }}>
            {error}
          </div>
        )}
        {saved && (
          <div style={{
            padding: '0.75rem', background: '#dcfce7', color: '#166534',
            borderRadius: '8px', fontSize: '0.85rem',
          }}>
            Configuración guardada correctamente.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>Host SMTP</label>
            <input
              value={host}
              onChange={e => setHost(e.target.value)}
              placeholder="smtp.gmail.com"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>Puerto</label>
            <input
              type="number"
              value={port}
              onChange={e => setPort(parseInt(e.target.value) || 587)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>Usuario</label>
            <input
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="user@example.com"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>
              Contraseña {initial ? '(dejar vacío para no cambiar)' : ''}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={initial ? '********' : 'Contraseña SMTP'}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>Email remitente (From)</label>
            <input
              value={from}
              onChange={e => setFrom(e.target.value)}
              placeholder="campana@example.com"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.25rem' }}>
            <input
              type="checkbox"
              id="secure"
              checked={secure}
              onChange={e => setSecure(e.target.checked)}
            />
            <label htmlFor="secure" style={{ fontSize: '0.85rem', color: '#334155' }}>
              SSL/TLS
            </label>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '6px',
            border: 'none', background: '#1e40af', color: '#fff',
            cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-start',
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>

      {/* Probar conexión */}
      {initial && (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}>
          <h2 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>
            Probar conexión
          </h2>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={labelStyle}>Email de destino para la prueba</label>
              <input
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="tu-email@example.com"
                style={inputStyle}
              />
            </div>
            <button
              onClick={handleTest}
              disabled={testing}
              style={{
                padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '6px',
                border: '1px solid #cbd5e1', background: '#fff', color: '#334155',
                cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
                opacity: testing ? 0.5 : 1,
              }}
            >
              {testing ? 'Enviando...' : 'Enviar prueba'}
            </button>
          </div>

          {testResult && (
            <div style={{
              padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem',
              background: testResult.success ? '#dcfce7' : '#fee2e2',
              color: testResult.success ? '#166534' : '#991b1b',
            }}>
              {testResult.success
                ? 'Email de prueba enviado correctamente. Verifica tu bandeja de entrada.'
                : `Error: ${testResult.error}`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem', color: '#334155', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', fontSize: '0.875rem', borderRadius: '6px',
  border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box',
}
