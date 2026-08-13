import Link from 'next/link'
import { createSession } from '../../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'

export default async function NuevaSesionPage() {
  await requireModuleOrRedirect('FORMACION', ['ADMIN_CAMPANA'])

  async function handleCreate(formData: FormData) {
    'use server'
    await createSession(formData)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
      <div>
        <Link href="/formacion/sesiones" style={{ color: '#64748b', fontSize: '0.8rem', textDecoration: 'none' }}>
          &larr; Volver a sesiones
        </Link>
        <h1 style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', color: '#0f172a' }}>
          Nueva sesión de capacitación
        </h1>
      </div>

      <form
        action={handleCreate}
        style={{
          background: '#fff', borderRadius: '12px', padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="title" style={labelStyle}>Título</label>
          <input id="title" name="title" required style={inputStyle} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="description" style={labelStyle}>Descripción (opcional)</label>
          <input id="description" name="description" style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="date" style={labelStyle}>Fecha y hora</label>
            <input id="date" name="date" type="datetime-local" required style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="location" style={labelStyle}>Lugar (opcional)</label>
            <input id="location" name="location" placeholder="Ej: Sede principal / Virtual" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="maxCapacity" style={labelStyle}>Capacidad máxima (opcional)</label>
          <input id="maxCapacity" name="maxCapacity" type="number" min="1" placeholder="Sin límite" style={inputStyle} />
        </div>

        <button type="submit" style={{
          padding: '0.75rem', fontSize: '0.875rem', borderRadius: '6px',
          border: 'none', background: '#1e40af', color: '#fff', cursor: 'pointer',
          fontWeight: 600, alignSelf: 'flex-start',
        }}>
          Crear sesión
        </button>
      </form>
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
