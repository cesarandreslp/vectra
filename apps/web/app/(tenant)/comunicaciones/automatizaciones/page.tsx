import { listAutomations, listTemplates, createAutomation, toggleAutomation } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'

const TRIGGERS: Record<string, string> = {
  NUEVO_ELECTOR:      'Nuevo elector registrado',
  CAMBIO_COMPROMISO:  'Cambio de estado de compromiso',
  DIA_ELECCION:       'Día de la elección',
  RECORDATORIO_VOTO:  'Recordatorio de voto',
}

export default async function AutomatizacionesPage() {
  await requireModuleOrRedirect('COMUNICACIONES', ['ADMIN_CAMPANA'])

  const [automations, templates] = await Promise.all([
    listAutomations(),
    listTemplates(),
  ])

  async function handleCreate(formData: FormData) {
    'use server'
    await createAutomation({
      name:         formData.get('name') as string,
      trigger:      formData.get('trigger') as string,
      channel:      formData.get('channel') as string,
      templateId:   formData.get('templateId') as string,
      delayMinutes: parseInt(formData.get('delayMinutes') as string) || 0,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
        Automatizaciones
      </h1>

      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
        Las automatizaciones envían mensajes automáticamente cuando ocurren eventos en el sistema.
        La integración con otros módulos se activará en una actualización posterior.
      </p>

      {/* Formulario nueva automatización */}
      <form
        action={handleCreate}
        style={{
          background: '#fff', borderRadius: '12px', padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>
          Nueva automatización
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="name" style={labelStyle}>Nombre</label>
            <input id="name" name="name" required style={inputStyle}
              placeholder="Ej: Bienvenida nuevo elector" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="trigger" style={labelStyle}>Evento disparador</label>
            <select id="trigger" name="trigger" required style={inputStyle}>
              {Object.entries(TRIGGERS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="channel" style={labelStyle}>Canal</label>
            <select id="channel" name="channel" required style={inputStyle}>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="templateId" style={labelStyle}>Plantilla</label>
            <select id="templateId" name="templateId" required style={inputStyle}>
              <option value="">Seleccionar...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="delayMinutes" style={labelStyle}>Retraso (min)</label>
            <input id="delayMinutes" name="delayMinutes" type="number"
              min="0" defaultValue="0" style={inputStyle} />
          </div>
        </div>

        <button type="submit" style={{
          padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '6px',
          border: 'none', background: '#1e40af', color: '#fff',
          cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-start',
        }}>
          Crear automatización
        </button>
      </form>

      {/* Lista de automatizaciones */}
      {automations.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nombre', 'Trigger', 'Canal', 'Plantilla', 'Retraso', 'Estado'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {automations.map(a => (
                <AutomationRow key={a.id} automation={a} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AutomationRow({ automation: a }: { automation: {
  id: string; name: string; trigger: string; channel: string
  templateName: string; isActive: boolean; delayMinutes: number
} }) {
  async function handleToggle() {
    'use server'
    await toggleAutomation(a.id)
  }

  return (
    <tr style={{ opacity: a.isActive ? 1 : 0.6 }}>
      <td style={tdStyle}>{a.name}</td>
      <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>
        {TRIGGERS[a.trigger] ?? a.trigger}
      </td>
      <td style={tdStyle}>
        <span style={{
          padding: '0.1rem 0.4rem', borderRadius: '9999px',
          fontSize: '0.65rem', fontWeight: 600,
          background: a.channel === 'EMAIL' ? '#dbeafe' : a.channel === 'SMS' ? '#dcfce7' : '#d1fae5',
          color: a.channel === 'EMAIL' ? '#1e40af' : a.channel === 'SMS' ? '#166534' : '#065f46',
        }}>
          {a.channel}
        </span>
      </td>
      <td style={{ ...tdStyle, fontSize: '0.8rem' }}>{a.templateName}</td>
      <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>
        {a.delayMinutes > 0 ? `${a.delayMinutes} min` : 'Inmediato'}
      </td>
      <td style={tdStyle}>
        <form action={handleToggle} style={{ display: 'inline' }}>
          <button type="submit" style={{
            padding: '0.15rem 0.5rem', borderRadius: '9999px',
            fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
            border: 'none',
            background: a.isActive ? '#dcfce7' : '#fee2e2',
            color: a.isActive ? '#166534' : '#991b1b',
          }}>
            {a.isActive ? 'Activa' : 'Inactiva'}
          </button>
        </form>
      </td>
    </tr>
  )
}

const TRIGGERS_MAP = TRIGGERS

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem', color: '#334155', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', fontSize: '0.875rem', borderRadius: '6px',
  border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box',
}
const thStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9',
}
