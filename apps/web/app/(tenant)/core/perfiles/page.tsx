import { buscarPerfiles } from './actions'
import { BuscadorPerfiles } from './_components/buscador-perfiles'

export const metadata = { title: 'Perfiles' }

export default async function PerfilesPage() {
  const iniciales = await buscarPerfiles({})

  return (
    <div style={{ maxWidth: '1000px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Perfiles de simpatizantes</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Lo que cada persona cargó de sí misma desde su PWA: qué sabe hacer, qué puede poner y cuándo puede.
        Buscá acá la gente que necesita cada actividad. Es información personal: usala solo para eso.
      </p>
      <BuscadorPerfiles iniciales={iniciales} />
    </div>
  )
}
