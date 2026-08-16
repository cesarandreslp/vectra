'use client'

import { useState } from 'react'
import { reportIncident } from '../../actions'

const TIPOS = [
  { value: 'IRREGULARIDAD',    label: 'Irregularidad' },
  { value: 'VIOLENCIA',        label: 'Violencia' },
  { value: 'FALTA_MATERIAL',   label: 'Falta de material' },
  { value: 'AUSENCIA_TESTIGO', label: 'Ausencia de testigo' },
  { value: 'OTRO',             label: 'Otro' },
]

const SEVERIDADES = [
  { value: 'ALTA',  label: 'Alta — requiere acción inmediata' },
  { value: 'MEDIA', label: 'Media — requiere seguimiento' },
  { value: 'BAJA',  label: 'Baja — informativo' },
]

export function FormIncidente({
  votingTableId,
  onClose,
}: {
  votingTableId: string
  onClose: () => void
}) {
  const [type, setType]               = useState('IRREGULARIDAD')
  const [description, setDescription] = useState('')
  const [severity, setSeverity]       = useState('MEDIA')
  const [photoFile, setPhotoFile]     = useState<File | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [submitted, setSubmitted]     = useState(false)

  async function handleSubmit() {
    if (!description.trim()) return
    setSubmitting(true)

    let photoUrl: string | undefined

    // Subir foto si existe
    if (photoFile) {
      const formData = new FormData()
      formData.append('file', photoFile)
      formData.append('votingTableId', votingTableId)
      const res = await fetch('/api/dia-e/upload-foto', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) photoUrl = data.url
    }

    await reportIncident({
      votingTableId,
      type,
      description: description.trim(),
      severity,
      photoUrl,
    })

    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div style={{
        background: '#dcfce7', borderRadius: '12px', padding: '1.5rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#9989;</div>
        <div style={{ fontWeight: 600, color: '#166534' }}>Incidente reportado</div>
        <button onClick={onClose} style={{
          marginTop: '0.75rem', padding: '0.5rem 1rem', fontSize: '0.85rem',
          borderRadius: '6px', border: '1px solid #22c55e', background: '#fff',
          color: '#166534', cursor: 'pointer',
        }}>
          Cerrar
        </button>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', gap: '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Reportar incidente</h2>
        <button onClick={onClose} style={linkBtnStyle}>Cancelar</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label style={labelStyle}>Tipo de incidente</label>
        <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label style={labelStyle}>Severidad</label>
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={inputStyle}>
          {SEVERIDADES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label style={labelStyle}>Descripción</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
          placeholder="Describe el incidente..."
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label style={labelStyle}>Foto (opcional)</label>
        {/* Sin `capture`: el selector del teléfono ofrece tomar la foto en el
            momento o subir una de la galería. El testigo elige. */}
        <input
          type="file"
          accept="image/*"
          onChange={e => setPhotoFile(e.target.files?.[0] ?? null)}
          style={inputStyle}
        />
        <span style={{ fontSize: '0.72rem', color: photoFile ? '#166534' : '#94a3b8' }}>
          {photoFile ? `✓ Adjunta: ${photoFile.name}` : 'Puedes tomarla con la cámara o subir una existente.'}
        </span>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!description.trim() || submitting}
        style={{
          padding: '0.75rem', fontSize: '0.875rem', borderRadius: '8px',
          border: 'none', background: '#ef4444', color: '#fff',
          cursor: !description.trim() || submitting ? 'not-allowed' : 'pointer',
          fontWeight: 600,
        }}
      >
        {submitting ? 'Enviando...' : 'Reportar incidente'}
      </button>
    </div>
  )
}

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#64748b',
  fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline',
}
const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem', color: '#334155', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', fontSize: '0.875rem', borderRadius: '6px',
  border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box',
}
