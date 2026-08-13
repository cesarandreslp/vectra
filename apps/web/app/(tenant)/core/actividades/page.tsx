import { getActividades, listElectoresParaActividad } from './actions'
import { PanelActividades } from './_components/panel-actividades'

export const metadata = { title: 'Actividades' }

export default async function ActividadesPage() {
  const [actividades, electores] = await Promise.all([getActividades(), listElectoresParaActividad()])

  return (
    <div style={{ maxWidth: '1000px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Actividades sociales</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Brigadas, jornadas y actividades que ejecutan los simpatizantes. Cada actividad se arma con grupos temporales por lugar, con sus miembros y su logística.
      </p>
      <PanelActividades actividades={actividades} electores={electores} />
    </div>
  )
}
