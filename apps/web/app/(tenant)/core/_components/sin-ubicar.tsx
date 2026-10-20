import Link from 'next/link'
import type { GeoStats } from '../actions'

/** Electores cuya dirección no encontró el buscador: corregirla en la ficha la vuelve a ubicar sola. */
export function SinUbicar({ electores }: { electores: GeoStats['noEncontrados'] }) {
  if (electores.length === 0) return null
  return (
    <details style={{ marginBottom: '0.75rem', fontSize: '0.8rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
      <summary style={{ cursor: 'pointer', color: '#92400e', fontWeight: 600 }}>
        {electores.length} con dirección que no se encontró en el mapa — corrígela en su ficha (Editar)
      </summary>
      <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', color: '#78350f' }}>
        {electores.map((e) => (
          <li key={e.id}>
            <Link href={`/core/electores/${e.id}/editar`} style={{ color: '#78350f', fontWeight: 600 }}>{e.name}</Link>
            {' — '}{e.address}
          </li>
        ))}
      </ul>
    </details>
  )
}
