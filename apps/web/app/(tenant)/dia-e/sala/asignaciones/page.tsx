import { listWitnessAssignments, assignWitness } from '../../actions'
import { requireModule } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb } from '@vectra/db'
import { TramiteRegistraduria } from './_components/tramite-registraduria'

export default async function AsignacionesPage() {
  const session = await requireModule('DIA_E', ['ADMIN_CAMPANA', 'COORDINADOR'])
  const tenantId = session.user.tenantId as string
  const conn = await getTenantConnection(tenantId)
  const db = getTenantDb(conn)

  const [assignments, testigos] = await Promise.all([
    listWitnessAssignments(),
    db.user.findMany({
      where:  { tenantId, role: 'TESTIGO', isActive: true },
      select: { id: true, email: true, name: true },
      orderBy: { email: 'asc' },
    }),
  ])

  const sinTestigo  = assignments.filter(a => !a.userId)
  const conTestigo  = assignments.filter(a => a.userId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
        Asignaciones de testigos
      </h1>

      <TramiteRegistraduria />

      {/* Resumen */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{
          background: '#fff', borderRadius: '8px', padding: '0.75rem 1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total mesas: </span>
          <span style={{ fontWeight: 700 }}>{assignments.length}</span>
        </div>
        <div style={{
          background: '#dcfce7', borderRadius: '8px', padding: '0.75rem 1rem',
        }}>
          <span style={{ fontSize: '0.75rem', color: '#166534' }}>Con testigo: </span>
          <span style={{ fontWeight: 700, color: '#166534' }}>{conTestigo.length}</span>
        </div>
        <div style={{
          background: '#fee2e2', borderRadius: '8px', padding: '0.75rem 1rem',
        }}>
          <span style={{ fontSize: '0.75rem', color: '#991b1b' }}>Sin testigo: </span>
          <span style={{ fontWeight: 700, color: '#991b1b' }}>{sinTestigo.length}</span>
        </div>
      </div>

      {/* Tabla */}
      <div style={{
        background: '#fff', borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflowX: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Mesa', 'Puesto', 'Municipio', 'Testigo', 'Registraduría', 'Confirmado', 'Asignar'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => (
              <AssignmentRow
                key={a.votingTableId}
                assignment={a}
                testigos={testigos}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AssignmentRow({ assignment: a, testigos }: {
  assignment: {
    votingTableId: string; tableNumber: number; stationName: string
    municipality: string; userId: string; userEmail: string
    confirmedAt: Date | null
    estado: string | null; observacion: string | null
  }
  testigos: { id: string; email: string; name: string | null }[]
}) {
  async function handleAssign(formData: FormData) {
    'use server'
    const witnessUserId = formData.get('witnessUserId') as string
    if (witnessUserId) {
      await assignWitness(witnessUserId, a.votingTableId, true)
    }
  }

  return (
    <tr>
      <td style={tdStyle}>{a.tableNumber}</td>
      <td style={tdStyle}>{a.stationName}</td>
      <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>{a.municipality}</td>
      <td style={tdStyle}>
        {a.userId ? (
          <span style={{ fontSize: '0.85rem' }}>{a.userEmail}</span>
        ) : (
          <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600 }}>Sin asignar</span>
        )}
      </td>
      <td style={tdStyle}>
        {a.estado ? (
          <span
            title={a.observacion ?? undefined}
            style={{
              padding: '0.15rem 0.5rem', borderRadius: '9999px',
              fontSize: '0.7rem', fontWeight: 600,
              ...(a.estado === 'APROBADO'  ? { background: '#dcfce7', color: '#166534' }
                : a.estado === 'RECHAZADO' ? { background: '#fee2e2', color: '#991b1b' }
                :                            { background: '#e0e7ff', color: '#3730a3' }),
            }}
          >
            {a.estado}
          </span>
        ) : '—'}
      </td>
      <td style={tdStyle}>
        {a.confirmedAt ? (
          <span style={{
            background: '#dcfce7', color: '#166534',
            padding: '0.15rem 0.5rem', borderRadius: '9999px',
            fontSize: '0.7rem', fontWeight: 600,
          }}>
            Confirmado
          </span>
        ) : a.userId ? (
          <span style={{
            background: '#fef3c7', color: '#92400e',
            padding: '0.15rem 0.5rem', borderRadius: '9999px',
            fontSize: '0.7rem', fontWeight: 600,
          }}>
            Pendiente
          </span>
        ) : '—'}
      </td>
      <td style={tdStyle}>
        <form action={handleAssign} style={{ display: 'flex', gap: '0.25rem' }}>
          <select name="witnessUserId" style={{
            padding: '0.25rem 0.4rem', fontSize: '0.75rem', borderRadius: '4px',
            border: '1px solid #cbd5e1', maxWidth: '180px',
          }}>
            <option value="">Seleccionar...</option>
            {testigos.map(t => (
              <option key={t.id} value={t.id}>
                {t.name ?? t.email}
              </option>
            ))}
          </select>
          <button type="submit" style={{
            padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px',
            border: '1px solid #1e40af', background: '#dbeafe', color: '#1e40af',
            cursor: 'pointer', fontWeight: 500,
          }}>
            Asignar
          </button>
        </form>
      </td>
    </tr>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9',
}
