import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { getEstructura } from './actions'
import { EstructuraPanel } from './_components/estructura-panel'

export const metadata = { title: 'Estructura' }

/** Estructura humana de la campaña — vista de solo lectura (ADMIN_CAMPANA / COORDINADOR). */
export default async function EstructuraPage() {
  await requireAuthOrRedirect(['ADMIN_CAMPANA', 'COORDINADOR'], '/login', ['CORE_ESTRUCTURA'])
  const data = await getEstructura()

  return (
    <div style={{ maxWidth: '760px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>
        Estructura humana de la campaña
      </h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Todo el equipo en una vista. Cada bloque se edita donde ya vivía.
      </p>
      <EstructuraPanel data={data} />
    </div>
  )
}
