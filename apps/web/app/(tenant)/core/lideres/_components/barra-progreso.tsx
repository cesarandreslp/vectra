/**
 * Barra de progreso de compromisos para la tarjeta de un líder.
 * Muestra visualmente cuántos comprometidos hay respecto a la meta.
 */

interface BarraProgresoProps {
  valor:       number
  meta:        number // en votos
  necesarios:  number // compromisos que pide la meta descontando la fuga
  pct:         number // 0-100, valor sobre necesarios
}

export function BarraProgreso({ valor, meta, necesarios, pct }: BarraProgresoProps) {
  // Color según nivel de avance
  const colorBarra =
    pct >= 80 ? '#22c55e' :
    pct >= 50 ? '#f59e0b' :
                '#ef4444'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
        <span style={{ color: '#64748b' }}>Avance</span>
        <span style={{ fontWeight: 600, color: colorBarra }}>{pct}%</span>
      </div>
      <div
        style={{
          height:       '6px',
          background:   '#e2e8f0',
          borderRadius: '999px',
          overflow:     'hidden',
        }}
      >
        <div
          style={{
            height:       '100%',
            width:        `${Math.min(pct, 100)}%`,
            background:   colorBarra,
            borderRadius: '999px',
            transition:   'width 0.3s',
          }}
        />
      </div>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '3px' }}>
        {valor} / {necesarios} compromisos · meta {meta} votos
      </div>
    </div>
  )
}
