import type { Cobertura } from '../../../dia-e/actions'

/**
 * Qué mesas siguen sin testigo. Se muestra junto al alta y no en una pantalla
 * aparte porque es el dato que decide a quién nombrar a continuación: se lee,
 * se crea el testigo, y la lista se achica sola en el siguiente render.
 */
export function CoberturaMesas({ cobertura }: { cobertura: Cobertura }) {
  const { mesasTotales, conTestigo, puestos } = cobertura
  const faltan = mesasTotales - conTestigo
  const pct    = mesasTotales > 0 ? Math.round((conTestigo / mesasTotales) * 100) : 0

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.95rem' }}>Cobertura de mesas</strong>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
          {conTestigo} de {mesasTotales} con testigo ({pct}%)
        </span>
        {faltan > 0 && (
          <span style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 600 }}>
            · faltan {faltan}
          </span>
        )}
      </div>

      <div style={{ height: 6, borderRadius: 999, background: '#e2e8f0', margin: '0.6rem 0', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#16a34a' : '#1e40af' }} />
      </div>

      {puestos.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#166534' }}>
          Todas las mesas tienen testigo.
        </p>
      ) : (
        <>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
            Sin cubrir, empezando por el puesto más descubierto:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: 220, overflowY: 'auto' }}>
            {puestos.map(p => (
              <div key={p.id} style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.4 }}>
                <strong>{p.name}</strong>{' '}
                <span style={{ color: '#991b1b' }}>faltan {p.sinTestigo.length}</span>
                <span style={{ color: '#94a3b8' }}> de {p.total} — mesas {p.sinTestigo.join(', ')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
