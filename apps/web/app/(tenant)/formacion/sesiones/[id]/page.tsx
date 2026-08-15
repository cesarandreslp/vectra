import Link from 'next/link'
import { getSessionDetail, enrollInSession, confirmAttendance } from '../../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params
  const session   = await requireModuleOrRedirect('FORMACION')
  const isAdmin   = session.user.role === 'ADMIN_CAMPANA'
  const userId    = session.user.id
  const detail    = await getSessionDetail(sessionId)

  if (!detail) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
        Sesión no encontrada.{' '}
        <Link href="/formacion/sesiones" style={{ color: '#1e40af' }}>Volver</Link>
      </div>
    )
  }

  const fecha       = new Date(detail.date)
  const isPast      = fecha < new Date()
  const isEnrolled  = detail.attendees.some(a => a.userId === userId)
  const isFull      = detail.maxCapacity ? detail.inscribed >= detail.maxCapacity : false

  async function handleEnroll() {
    'use server'
    await enrollInSession(sessionId)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '700px' }}>
      <div>
        <Link href="/formacion/sesiones" style={{ color: '#64748b', fontSize: '0.8rem', textDecoration: 'none' }}>
          &larr; Volver a sesiones
        </Link>
        <h1 style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', color: '#0f172a' }}>
          {detail.title}
        </h1>
        {detail.description && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>
            {detail.description}
          </p>
        )}
      </div>

      {/* Info card */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem',
      }}>
        <InfoItem label="Fecha" value={fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
        <InfoItem label="Hora" value={fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} />
        <InfoItem label="Lugar" value={detail.location ?? 'No especificado'} />
        <InfoItem
          label="Cupos"
          value={detail.maxCapacity ? `${detail.inscribed} / ${detail.maxCapacity}` : `${detail.inscribed} inscritos`}
        />
      </div>

      {/* Botón de inscripción (solo si no es admin y la sesión no pasó) */}
      {!isAdmin && !isPast && !isEnrolled && !isFull && (
        <form action={handleEnroll}>
          <button type="submit" style={{
            padding: '0.75rem 1.5rem', fontSize: '0.875rem', borderRadius: '6px',
            border: 'none', background: '#1e40af', color: '#fff', cursor: 'pointer',
            fontWeight: 600,
          }}>
            Inscribirme
          </button>
        </form>
      )}

      {isEnrolled && !isAdmin && (
        <div style={{
          background: '#dcfce7', color: '#166534', padding: '0.75rem 1rem',
          borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500,
        }}>
          Ya estás inscrito en esta sesión
        </div>
      )}

      {isFull && !isEnrolled && !isAdmin && (
        <div style={{
          background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem',
          borderRadius: '8px', fontSize: '0.875rem',
        }}>
          La sesión está llena
        </div>
      )}

      {/* Lista de asistentes (solo admin) */}
      {isAdmin && detail.attendees.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflowX: 'auto',
        }}>
          <h2 style={{ margin: 0, padding: '1rem 1.25rem 0', fontSize: '1rem', color: '#334155' }}>
            Inscritos ({detail.attendees.length})
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Email', 'Nombre', 'Asistencia'].map(h => (
                  <th key={h} style={headerStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.attendees.map(a => (
                <AttendeeRow key={a.userId} attendee={a} sessionId={sessionId} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && detail.attendees.length === 0 && (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '2rem',
          textAlign: 'center', color: '#94a3b8',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          No hay inscritos aún
        </div>
      )}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '0.875rem', color: '#0f172a', marginTop: '0.15rem' }}>{value}</div>
    </div>
  )
}

function AttendeeRow({ attendee: a, sessionId }: {
  attendee: { userId: string; email: string; name: string | null; attended: boolean }
  sessionId: string
}) {
  async function handleConfirm() {
    'use server'
    await confirmAttendance(sessionId, a.userId)
  }

  return (
    <tr>
      <td style={cellStyle}>{a.email}</td>
      <td style={cellStyle}>{a.name ?? '—'}</td>
      <td style={cellStyle}>
        {a.attended ? (
          <span style={{
            background: '#dcfce7', color: '#166534',
            padding: '0.15rem 0.5rem', borderRadius: '9999px',
            fontSize: '0.75rem', fontWeight: 600,
          }}>
            Confirmada
          </span>
        ) : (
          <form action={handleConfirm} style={{ display: 'inline' }}>
            <button type="submit" style={{
              padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px',
              border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer',
              color: '#334155',
            }}>
              Confirmar asistencia
            </button>
          </form>
        )}
      </td>
    </tr>
  )
}

const headerStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem', textAlign: 'left', fontSize: '0.75rem',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const cellStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem', fontSize: '0.875rem', borderBottom: '1px solid #f1f5f9',
}
