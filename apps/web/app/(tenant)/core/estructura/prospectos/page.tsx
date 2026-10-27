import Link from 'next/link'
import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { getEmbudo } from '../actions-prospectos'
import { Embudo } from './_components/embudo'

export const metadata = { title: 'Lista de los 100' }

/** Embudo de reclutamiento de líderes (ADMIN_CAMPANA / COORDINADOR). */
export default async function ProspectosPage() {
  await requireAuthOrRedirect(['ADMIN_CAMPANA', 'COORDINADOR'], '/login', ['CORE_ESTRUCTURA'])
  const data = await getEmbudo()

  return (
    <div>
      <Link href="/core/estructura" style={{ fontSize: '0.8rem', color: '#1e40af' }}>← Estructura</Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0 0.35rem' }}>Lista de los 100</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
        Prospectos a líder, de candidato a decisión. Al aceptar quedan enlazados a su elector en el árbol.
      </p>
      <Embudo data={data} />
    </div>
  )
}
