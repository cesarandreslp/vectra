import Link from 'next/link'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { QuizBuilder } from './_components/quiz-builder'

export default async function NuevaEvaluacionPage() {
  await requireModuleOrRedirect('FORMACION', ['ADMIN_CAMPANA'])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '700px' }}>
      <div>
        <Link href="/formacion/evaluaciones" style={{ color: '#64748b', fontSize: '0.8rem', textDecoration: 'none' }}>
          &larr; Volver a evaluaciones
        </Link>
        <h1 style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', color: '#0f172a' }}>
          Nueva evaluación
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
          Agrega preguntas y marca la respuesta correcta con el círculo verde.
        </p>
      </div>

      <QuizBuilder />
    </div>
  )
}
