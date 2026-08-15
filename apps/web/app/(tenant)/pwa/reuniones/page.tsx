import { PanelReuniones } from './_components/panel-reuniones'

export default function PwaReunionesPage() {
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Reuniones</h1>
      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem' }}>
        Convoca reuniones con tu gente y marca quién asistió — cuenta para su índice de compromiso.
      </p>
      <PanelReuniones />
    </div>
  )
}
