import Link from 'next/link'
import { listSessions, deleteSession } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'

export default async function SesionesPage() {
  const session  = await requireModuleOrRedirect('FORMACION')
  const isAdmin  = session.user.role === 'ADMIN_CAMPANA'
  const sesiones = await listSessions()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
          Sesiones de capacitación
        </h1>
        {isAdmin && (
          <Link
            href="/formacion/sesiones/nueva"
            style={{
              background: '#1e40af', color: '#fff', padding: '0.5rem 1rem',
              borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            + Nueva sesión
          </Link>
        )}
      </div>

      {sesiones.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {sesiones.map(s => (
            <SessionCard key={s.id} session={s} isAdmin={isAdmin} />
          ))}
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '3rem',
          textAlign: 'center', color: '#94a3b8',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          No hay sesiones programadas
        </div>
      )}
    </div>
  )
}

function SessionCard({ session: s, isAdmin }: {
  session: { id: string; title: string; description: string | null; date: Date; location: string | null; maxCapacity: number | null; inscribed: number }
  isAdmin: boolean
}) {
  const fecha   = new Date(s.date)
  const isPast  = fecha < new Date()

  async function handleDelete() {
    'use server'
    await deleteSession(s.id)
  }

  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      opacity: isPast ? 0.7 : 1,
    }}>
      <div>
        <Link
          href={`/formacion/sesiones/${s.id}`}
          style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' }}
        >
          {s.title}
        </Link>
        {s.description && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            {s.description}
          </p>
        )}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
          <span>{fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span>{fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
          {s.location && <span>{s.location}</span>}
          <span>
            {s.inscribed} inscrito{s.inscribed !== 1 ? 's' : ''}
            {s.maxCapacity ? ` / ${s.maxCapacity}` : ''}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {isPast && (
          <span style={{
            fontSize: '0.7rem', color: '#94a3b8', background: '#f1f5f9',
            padding: '0.15rem 0.5rem', borderRadius: '9999px',
          }}>
            Finalizada
          </span>
        )}
        {isAdmin && (
          <form action={handleDelete}>
            <button type="submit" style={{
              padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px',
              border: '1px solid #fecaca', background: '#fff', color: '#ef4444', cursor: 'pointer',
            }}>
              Eliminar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
