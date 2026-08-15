import { getAnfitrionesAdmin } from '../agenda/actions'
import { PanelRutas } from './_components/panel-rutas'

export const metadata = { title: 'Rutas' }

export default async function RutasPage() {
  const anfitriones = await getAnfitrionesAdmin()

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Rutas</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        Orden sugerido por cercanía de las reuniones del día — editable a mano.
      </p>
      <PanelRutas anfitriones={anfitriones} />
    </div>
  )
}
