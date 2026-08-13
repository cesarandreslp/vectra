import Link from 'next/link'
import { listQuizzes, deleteQuiz } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'

export default async function EvaluacionesPage() {
  const session  = await requireModuleOrRedirect('FORMACION')
  const isAdmin  = session.user.role === 'ADMIN_CAMPANA'
  const quizzes  = await listQuizzes()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
          Evaluaciones
        </h1>
        {isAdmin && (
          <Link
            href="/formacion/evaluaciones/nueva"
            style={{
              background: '#1e40af', color: '#fff', padding: '0.5rem 1rem',
              borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            + Nueva evaluación
          </Link>
        )}
      </div>

      {quizzes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {quizzes.map(q => (
            <QuizCard key={q.id} quiz={q} isAdmin={isAdmin} />
          ))}
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '3rem',
          textAlign: 'center', color: '#94a3b8',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          No hay evaluaciones disponibles
        </div>
      )}
    </div>
  )
}

function QuizCard({ quiz: q, isAdmin }: {
  quiz: {
    id: string; title: string; description: string | null;
    passingScore: number; questionCount: number;
    bestScore: number | null; passed: boolean
  }
  isAdmin: boolean
}) {
  async function handleDelete() {
    'use server'
    await deleteQuiz(q.id)
  }

  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <Link
          href={`/formacion/evaluaciones/${q.id}`}
          style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' }}
        >
          {q.title}
        </Link>
        {q.description && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            {q.description}
          </p>
        )}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
          <span>{q.questionCount} pregunta{q.questionCount !== 1 ? 's' : ''}</span>
          <span>Mínimo: {q.passingScore}%</span>
          {q.bestScore !== null && (
            <span>Mejor puntaje: {q.bestScore}%</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {q.passed && (
          <span style={{
            background: '#dcfce7', color: '#166534',
            padding: '0.2rem 0.6rem', borderRadius: '9999px',
            fontSize: '0.75rem', fontWeight: 600,
          }}>
            Aprobado
          </span>
        )}
        {q.bestScore !== null && !q.passed && (
          <span style={{
            background: '#fee2e2', color: '#991b1b',
            padding: '0.2rem 0.6rem', borderRadius: '9999px',
            fontSize: '0.75rem', fontWeight: 600,
          }}>
            No aprobado
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
