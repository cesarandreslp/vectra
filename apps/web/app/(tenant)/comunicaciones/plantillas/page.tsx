import Link from 'next/link'
import { listAllTemplates, toggleTemplateActive } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'

export default async function PlantillasPage() {
  await requireModuleOrRedirect('COMUNICACIONES', ['ADMIN_CAMPANA'])

  const templates = await listAllTemplates()

  const channels = ['EMAIL', 'SMS', 'WHATSAPP'] as const
  const channelColors: Record<string, { bg: string; text: string }> = {
    EMAIL:    { bg: '#dbeafe', text: '#1e40af' },
    SMS:      { bg: '#dcfce7', text: '#166534' },
    WHATSAPP: { bg: '#d1fae5', text: '#065f46' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
          Plantillas de mensajes
        </h1>
        <Link
          href="/comunicaciones/plantillas/nueva"
          style={{
            padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '6px',
            background: '#1e40af', color: '#fff', textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Nueva plantilla
        </Link>
      </div>

      {channels.map(ch => {
        const channelTemplates = templates.filter(t => t.channel === ch)
        if (channelTemplates.length === 0) return null

        const colors = channelColors[ch]

        return (
          <div key={ch}>
            <h2 style={{
              margin: '0 0 0.75rem', fontSize: '0.9rem', color: colors.text,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <span style={{
                padding: '0.15rem 0.5rem', borderRadius: '9999px',
                fontSize: '0.7rem', fontWeight: 600,
                background: colors.bg, color: colors.text,
              }}>
                {ch}
              </span>
              {channelTemplates.length} plantilla{channelTemplates.length !== 1 ? 's' : ''}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {channelTemplates.map(t => (
                <TemplateCard key={t.id} template={t} />
              ))}
            </div>
          </div>
        )
      })}

      {templates.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '3rem',
          textAlign: 'center', color: '#94a3b8',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          No hay plantillas. Crea la primera.
        </div>
      )}
    </div>
  )
}

function TemplateCard({ template: t }: { template: {
  id: string; name: string; channel: string; subject: string | null
  body: string; variables: string[]; isActive: boolean; createdAt: Date
} }) {
  async function handleToggle() {
    'use server'
    await toggleTemplateActive(t.id)
  }

  return (
    <div style={{
      background: '#fff', borderRadius: '8px', padding: '1rem 1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      opacity: t.isActive ? 1 : 0.6,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
          {t.name}
        </div>
        {t.subject && (
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
            Asunto: {t.subject}
          </div>
        )}
        <div style={{
          fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          maxWidth: '500px',
        }}>
          {t.body.substring(0, 100)}{t.body.length > 100 ? '...' : ''}
        </div>
        {t.variables.length > 0 && (
          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {t.variables.map(v => (
              <span key={v} style={{
                padding: '0.1rem 0.4rem', borderRadius: '4px',
                fontSize: '0.65rem', background: '#f1f5f9', color: '#64748b',
              }}>
                {`{{${v}}}`}
              </span>
            ))}
          </div>
        )}
      </div>

      <form action={handleToggle}>
        <button type="submit" style={{
          padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '9999px',
          border: 'none', cursor: 'pointer', fontWeight: 600,
          background: t.isActive ? '#dcfce7' : '#fee2e2',
          color: t.isActive ? '#166534' : '#991b1b',
        }}>
          {t.isActive ? 'Activa' : 'Inactiva'}
        </button>
      </form>
    </div>
  )
}
