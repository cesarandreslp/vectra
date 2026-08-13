import { getPresupuestos } from './actions'
import { PanelPresupuestos } from './_components/panel-presupuestos'

export const metadata = { title: 'Presupuestos' }

export default async function PresupuestosPage() {
  const [pendientes, aprobados] = await Promise.all([getPresupuestos(true), getPresupuestos(false)])

  return (
    <div style={{ maxWidth: '1000px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Presupuestos de actividades</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Ninguna actividad se ejecuta sin que el área financiera apruebe su presupuesto. Si después cambian los insumos, la aprobación se cae y hay que rehacerla.
      </p>
      <PanelPresupuestos pendientes={pendientes} aprobados={aprobados} />
    </div>
  )
}
