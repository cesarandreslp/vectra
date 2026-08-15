import { redirect } from 'next/navigation'
import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { getTesoreria } from './actions'
import { TesoreriaPanel } from './_components/tesoreria-panel'

export const metadata = { title: 'Tesorería' }

/** Hub de plata de la campaña — solo lectura, ADMIN_CAMPANA, con FINANZAS activo. */
export default async function TesoreriaPage() {
  const session = await requireAuthOrRedirect(['ADMIN_CAMPANA'], '/login', ['CORE_TESORERIA'])
  if (!session.user.activeModules.includes('FINANZAS')) redirect('/core')
  const data = await getTesoreria()

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>
        Tesorería
      </h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Toda la plata de la campaña en un lugar: presupuestos, movimiento, tope legal e informes.
        Cada bloque se edita donde ya vivía.
      </p>
      <TesoreriaPanel data={data} />
    </div>
  )
}
