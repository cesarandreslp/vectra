'use client'

import { useState } from 'react'
import { createTemplate } from '../../../actions'

const SAMPLE_DATA: Record<string, string> = {
  nombre: 'Juan Pérez',
  telefono: '3101234567',
  municipio: 'Bogotá',
  lider: 'María García',
  estado_compromiso: 'Comprometido',
  candidato: 'Carlos López',
}

const AVAILABLE_VARS = Object.keys(SAMPLE_DATA)

export function TemplateEditor() {
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<string>('EMAIL')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Preview en tiempo real
  const preview = body.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => SAMPLE_DATA[key] ?? `{{${key}}}`
  )

  async function handleSave() {
    if (!name.trim() || !body.trim()) {
      setError('Completa el nombre y el cuerpo del mensaje')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createTemplate({
        name,
        channel,
        subject: channel === 'EMAIL' ? subject : undefined,
        body,
      })
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div style={{
        background: '#dcfce7', borderRadius: '12px', padding: '2rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#166534', marginBottom: '0.5rem' }}>
          Plantilla creada
        </div>
        <a
          href="/comunicaciones/plantillas"
          style={{ color: '#1e40af', textDecoration: 'none', fontSize: '0.85rem' }}
        >
          Volver a plantillas
        </a>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      {/* Editor */}
      <div style={{
        flex: 1, background: '#fff', borderRadius: '12px', padding: '1.5rem',
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>Nombre</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Bienvenida nuevo elector"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>Canal</label>
            <select value={channel} onChange={e => setChannel(e.target.value)} style={inputStyle}>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </div>
        </div>

        {channel === 'EMAIL' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>Asunto</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Asunto del email..."
              style={inputStyle}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={labelStyle}>Cuerpo del mensaje</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={`Hola {{nombre}}, tu líder {{lider}} te invita a...`}
            rows={8}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }}
          />
        </div>

        {/* Variables disponibles */}
        <div>
          <label style={{ ...labelStyle, marginBottom: '0.25rem', display: 'block' }}>
            Variables disponibles (clic para insertar)
          </label>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {AVAILABLE_VARS.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setBody(b => b + `{{${v}}}`)}
                style={{
                  padding: '0.2rem 0.5rem', borderRadius: '4px',
                  fontSize: '0.75rem', border: '1px solid #cbd5e1',
                  background: '#f8fafc', color: '#334155', cursor: 'pointer',
                }}
              >
                {`{{${v}}}`}
              </button>
            ))}
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
          {saving ? 'Guardando...' : 'Crear plantilla'}
        </button>
      </div>

      {/* Preview */}
      <div style={{
        width: '300px', flexShrink: 0,
        background: '#fff', borderRadius: '12px', padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        alignSelf: 'flex-start',
      }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
          Vista previa
        </h3>
        {channel === 'EMAIL' && subject && (
          <div style={{
            fontSize: '0.8rem', fontWeight: 600, color: '#334155',
            marginBottom: '0.5rem', paddingBottom: '0.5rem',
            borderBottom: '1px solid #e2e8f0',
          }}>
            {subject.replace(/\{\{(\w+)\}\}/g, (_, k: string) => SAMPLE_DATA[k] ?? `{{${k}}}`)}
          </div>
        )}
        <div style={{
          fontSize: '0.85rem', color: '#0f172a', lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}>
          {preview || 'Escribe el cuerpo del mensaje para ver la vista previa...'}
        </div>
      </div>
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
