'use client'

import { useState } from 'react'
import { createCampaign, previewSegment, sendCampaign } from '../../../actions'
import type { TemplateView } from '../../../actions'

type Step = 1 | 2 | 3

interface Filters {
  [key: string]: string | undefined
  leaderId?: string
  zone?: string
  commitmentStatus?: string
  role?: string
  municipalityId?: string
}

export function CampaignWizard({ templates }: { templates: TemplateView[] }) {
  const [step, setStep] = useState<Step>(1)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  // Paso 1
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<string>('EMAIL')
  const [templateId, setTemplateId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  // Paso 2
  const [filters, setFilters] = useState<Filters>({})
  const [previewTotal, setPreviewTotal] = useState<number | null>(null)
  const [previewSample, setPreviewSample] = useState<{ name: string; type: string }[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  const filteredTemplates = templates.filter(t => t.channel === channel)

  async function handlePreviewSegment() {
    setLoadingPreview(true)
    try {
      const result = await previewSegment(channel, filters)
      setPreviewTotal(result.total)
      setPreviewSample(result.sample)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al previsualizar')
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleCreateAndSend() {
    setSending(true)
    setError(null)
    try {
      const id = await createCampaign({
        name,
        channel,
        templateId,
        segmentFilters: filters,
        scheduledAt: scheduledAt || null,
      })
      setCreatedId(id)

      // Si no tiene fecha programada, enviar inmediatamente
      if (!scheduledAt) {
        await sendCampaign(id)
      }

      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear la campaña')
    } finally {
      setSending(false)
    }
  }

  // ── Paso 3: Confirmación ───────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#9989;</div>
        <h2 style={{ margin: '0 0 0.5rem', color: '#166534' }}>
          {scheduledAt ? 'Campaña programada' : 'Campaña enviada'}
        </h2>
        <p style={{ color: '#64748b', margin: '0 0 1.5rem' }}>
          {scheduledAt
            ? `Se enviará el ${new Date(scheduledAt).toLocaleString('es-CO')}`
            : `Se envió a ${previewTotal ?? 0} destinatarios`}
        </p>
        <a
          href={createdId ? `/comunicaciones/campanas/${createdId}` : '/comunicaciones/campanas'}
          style={{
            padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '6px',
            background: '#1e40af', color: '#fff', textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Ver detalle
        </a>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', gap: '1.5rem',
    }}>
      {/* Indicador de pasos */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
        {[1, 2].map(s => (
          <div key={s} style={{
            flex: 1, height: '4px', borderRadius: '2px',
            background: s <= step ? '#1e40af' : '#e2e8f0',
          }} />
        ))}
      </div>

      {error && (
        <div style={{
          padding: '0.75rem', background: '#fee2e2', color: '#991b1b',
          borderRadius: '8px', fontSize: '0.85rem',
        }}>
          {error}
        </div>
      )}

      {/* ── Paso 1: Configuración ──────────────────────────────────────────── */}
      {step === 1 && (
        <>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#334155' }}>
            Paso 1 — Configuración
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>Nombre de la campaña</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Recordatorio día de elección"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={labelStyle}>Canal</label>
              <select
                value={channel}
                onChange={e => { setChannel(e.target.value); setTemplateId('') }}
                style={inputStyle}
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={labelStyle}>Plantilla</label>
              <select
                value={templateId}
                onChange={e => setTemplateId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar plantilla...</option>
                {filteredTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={labelStyle}>Fecha de envío (opcional — vacío = envío inmediato)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              style={inputStyle}
            />
          </div>

          <button
            onClick={() => {
              if (!name.trim() || !templateId) {
                setError('Completa el nombre y selecciona una plantilla')
                return
              }
              setError(null)
              setStep(2)
            }}
            style={{
              ...btnPrimary,
              alignSelf: 'flex-end',
              opacity: (!name.trim() || !templateId) ? 0.5 : 1,
            }}
          >
            Siguiente
          </button>
        </>
      )}

      {/* ── Paso 2: Segmentación ───────────────────────────────────────────── */}
      {step === 2 && (
        <>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#334155' }}>
            Paso 2 — Segmentación de destinatarios
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={labelStyle}>Zona (opcional)</label>
              <input
                value={filters.zone ?? ''}
                onChange={e => setFilters({ ...filters, zone: e.target.value || undefined })}
                placeholder="Ej: Norte"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={labelStyle}>Estado de compromiso</label>
              <select
                value={filters.commitmentStatus ?? ''}
                onChange={e => setFilters({ ...filters, commitmentStatus: e.target.value || undefined })}
                style={inputStyle}
              >
                <option value="">Todos</option>
                <option value="SIN_CONTACTAR">Sin contactar</option>
                <option value="CONTACTADO">Contactado</option>
                <option value="SIMPATIZANTE">Simpatizante</option>
                <option value="COMPROMETIDO">Comprometido</option>
                <option value="VOTO_SEGURO">Voto seguro</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={labelStyle}>ID del líder (opcional)</label>
              <input
                value={filters.leaderId ?? ''}
                onChange={e => setFilters({ ...filters, leaderId: e.target.value || undefined })}
                placeholder="ID del líder"
                style={inputStyle}
              />
            </div>

            {channel === 'EMAIL' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={labelStyle}>Rol (solo usuarios)</label>
                <select
                  value={filters.role ?? ''}
                  onChange={e => setFilters({ ...filters, role: e.target.value || undefined })}
                  style={inputStyle}
                >
                  <option value="">Todos los roles</option>
                  <option value="ADMIN_CAMPANA">Admin campaña</option>
                  <option value="COORDINADOR">Coordinador</option>
                  <option value="LIDER">Líder</option>
                  <option value="TESTIGO">Testigo</option>
                </select>
              </div>
            )}
          </div>

          <button
            onClick={handlePreviewSegment}
            disabled={loadingPreview}
            style={{
              padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '6px',
              border: '1px solid #cbd5e1', background: '#fff', color: '#334155',
              cursor: 'pointer', fontWeight: 500, alignSelf: 'flex-start',
            }}
          >
            {loadingPreview ? 'Calculando...' : 'Previsualizar destinatarios'}
          </button>

          {previewTotal !== null && (
            <div style={{
              padding: '1rem', background: '#f0f9ff', borderRadius: '8px',
              border: '1px solid #bae6fd',
            }}>
              <div style={{ fontWeight: 600, color: '#0c4a6e', marginBottom: '0.5rem' }}>
                {previewTotal} destinatario{previewTotal !== 1 ? 's' : ''} seleccionado{previewTotal !== 1 ? 's' : ''}
              </div>
              {previewSample.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Muestra: {previewSample.map(r => `${r.name} (${r.type})`).join(', ')}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between' }}>
            <button
              onClick={() => setStep(1)}
              style={{
                padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '6px',
                border: '1px solid #cbd5e1', background: '#fff', color: '#334155',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              Atrás
            </button>
            <button
              onClick={handleCreateAndSend}
              disabled={sending}
              style={{
                ...btnPrimary,
                opacity: sending ? 0.5 : 1,
              }}
            >
              {sending
                ? 'Enviando...'
                : scheduledAt
                  ? 'Programar envío'
                  : 'Enviar ahora'}
            </button>
          </div>
        </>
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
const btnPrimary: React.CSSProperties = {
  padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '6px',
  border: 'none', background: '#1e40af', color: '#fff',
  cursor: 'pointer', fontWeight: 600,
}
