'use client'

import { useSearchParams } from 'next/navigation'
import { FormularioElector } from '../_components/formulario-elector'

export default function NuevoElectorPage() {
  // Prellenado al venir de "+ Elector" en la ficha de un elector con red
  // (antes existía un flujo aparte de "crear líder" — ya no: todos se crean
  // como electores, "líder" es una etiqueta que aparece sola al llegar a 10
  // directos, no algo que se elige al crear a alguien).
  const leaderIdInicial = useSearchParams().get('leaderId') ?? ''

  return (
    <div style={{ maxWidth: '500px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Nuevo elector</h1>
      <FormularioElector leaderIdInicial={leaderIdInicial} />
    </div>
  )
}
