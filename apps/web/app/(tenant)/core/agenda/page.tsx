import { getAnfitrionesAdmin, getReunionesReclutamiento, getGestionAgenda } from './actions'
import { PanelGestion } from './_components/panel-gestion'
import { PanelAnfitrion } from './_components/panel-anfitrion'
import { PanelReclutamiento } from './_components/panel-reclutamiento'

export const metadata = { title: 'Agenda' }

export default async function AgendaAdminPage() {
  const [anfitriones, reuniones, gestion] = await Promise.all([
    getAnfitrionesAdmin(),
    getReunionesReclutamiento(),
    getGestionAgenda(),
  ])

  return (
    <div style={{ maxWidth: '1000px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Agenda</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Agenda y convocatorias del candidato y jefes de debate, y las reuniones de reclutamiento que organizan los electores.
      </p>

      <PanelGestion gestion={gestion} />

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Candidato y jefes de debate</h2>
      <div style={{ marginBottom: '2rem' }}>
        <PanelAnfitrion anfitriones={anfitriones} />
      </div>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Reuniones de reclutamiento</h2>
      <PanelReclutamiento reuniones={reuniones} />
    </div>
  )
}
