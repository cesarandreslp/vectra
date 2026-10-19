'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { NodoOrganizacion } from '../../actions'

const COLOR_ESTADO: Record<string, string> = {
  SIN_CONTACTAR: '#94a3b8',
  CONTACTADO:    '#3b82f6',
  SIMPATIZANTE:  '#eab308',
  COMPROMETIDO:  '#22c55e',
  VOTO_SEGURO:   '#15803d',
}

/**
 * La gente de un líder que no tiene gente propia, en columna bajo su caja:
 * catorce cajas sueltas a lo ancho harían ilegible el árbol. Plegable.
 */
export function GenteDe({ electores }: { electores: NodoOrganizacion['electores'] }) {
  const [abierto, setAbierto] = useState(electores.length <= 8)

  return (
    <div className="organigrama-gente" style={{
      marginTop: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '0.35rem 0.5rem', minWidth: '140px', textAlign: 'left',
    }}>
      <button
        type="button" onClick={() => setAbierto((v) => !v)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, color: '#475569' }}
      >
        {abierto ? '▾' : '▸'} {electores.length} {electores.length === 1 ? 'persona' : 'personas'}
      </button>
      {abierto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
          {electores.map((e) => (
            <Link key={e.id} href={`/core/electores/${e.id}`} title={e.commitmentStatus.replace(/_/g, ' ')} style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem',
              color: '#0f172a', textDecoration: 'none', whiteSpace: 'nowrap',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: COLOR_ESTADO[e.commitmentStatus] ?? '#94a3b8' }} />
              {e.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
