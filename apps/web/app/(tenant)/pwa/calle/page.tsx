import { getMiDia } from './actions'
import { CapturaCalle } from './_components/captura-calle'

export const metadata = { title: 'Calle' }

/** Contacto rápido del candidato: a quién saludó hoy. */
export default async function CallePage() {
  const dia = await getMiDia()

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.25rem' }}>En la calle</h1>
      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem' }}>
        Un toque por cada persona que saludas. Si te da sus datos, anótalos: le llegan al líder de su barrio.
      </p>
      {dia
        ? <CapturaCalle dia={dia} />
        : <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Esta pantalla es para el candidato, los jefes de debate y quien les lleva la agenda.</p>}
    </div>
  )
}
