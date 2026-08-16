import { getMyAssignment, getTransmissionStatus, listCandidates } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { TestigoFlow } from './_components/testigo-flow'

export default async function TestigoPage() {
  const session = await requireModuleOrRedirect('DIA_E', ['TESTIGO'])

  const [assignment, candidates] = await Promise.all([
    getMyAssignment(),
    listCandidates(),
  ])

  if (!assignment) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: '1rem',
      }}>
        <div style={{ fontSize: '3rem' }}>&#128203;</div>
        <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
          Sin mesa asignada
        </h1>
        <p style={{ color: '#64748b', textAlign: 'center', maxWidth: '300px' }}>
          Aún no tienes una mesa de votación asignada. Contacta a tu coordinador.
        </p>
      </div>
    )
  }

  const transmission = await getTransmissionStatus(assignment.votingTableId)

  return (
    <div>
      {/* Datos de la mesa */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1rem',
      }}>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '1px' }}>
          TU MESA ASIGNADA
        </div>
        <h2 style={{ margin: '0.25rem 0', fontSize: '1.25rem', color: '#0f172a' }}>
          Mesa {assignment.tableNumber}
        </h2>
        <div style={{ fontSize: '0.875rem', color: '#334155' }}>
          {assignment.stationName}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {assignment.stationAddress}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
          {assignment.municipality} — {assignment.department}
        </div>
      </div>

      <TestigoFlow
        assignment={assignment}
        candidates={candidates}
        initialTransmission={transmission}
      />
    </div>
  )
}
