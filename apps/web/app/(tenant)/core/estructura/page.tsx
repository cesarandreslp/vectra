import Link from 'next/link'
import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { getEstructura } from './actions'
import { EstructuraPanel } from './_components/estructura-panel'
import { getPlanEstructura } from './actions-plan'
import { getCargos } from './actions-cargos'
import { MetaCascada } from './_components/meta-cascada'
import { VamosATiempo } from './_components/vamos-a-tiempo'

export const metadata = { title: 'Estructura' }

/** Estructura humana de la campaña — vista de solo lectura (ADMIN_CAMPANA / COORDINADOR). */
export default async function EstructuraPage() {
  await requireAuthOrRedirect(['ADMIN_CAMPANA', 'COORDINADOR'], '/login', ['CORE_ESTRUCTURA'])
  const [data, plan, cargos] = await Promise.all([getEstructura(), getPlanEstructura(), getCargos()])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            Estructura humana de la campaña
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
            Todo el equipo en una vista. Cada bloque se edita donde ya vivía.
          </p>
        </div>
        {/* Atajo para armar el equipo: candidato, sede, roles y usuarios viven en
            Configuración. La cadena territorial NO — esa se arma en /core/lideres. */}
        <Link
          href="/core/configuracion"
          style={{ flexShrink: 0, background: '#1e40af', color: '#fff', fontSize: '0.85rem', fontWeight: 600, padding: '0.55rem 1.1rem', borderRadius: 8, whiteSpace: 'nowrap' }}
        >
          Armar estructura en Configuración →
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <MetaCascada plan={plan} />
        <VamosATiempo plan={plan} />
        <EstructuraPanel data={data} cargos={cargos} />
      </div>
    </div>
  )
}
