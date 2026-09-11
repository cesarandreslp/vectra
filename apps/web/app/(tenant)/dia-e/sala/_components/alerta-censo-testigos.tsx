interface Props {
  testigos: { nombre: string; estado: string | null }[]
}

const ETIQUETA: Record<string, string> = {
  NO_ENCONTRADO: 'no aparece en el censo',
  ERROR:         'la consulta falló',
  PENDIENTE:     'consultando…',
}

/**
 * Testigos cuya cédula no está confirmada en el censo electoral. Va justo antes
 * del trámite: si no aparece inscrita, la Registraduría puede rechazarlos, y es
 * mejor reemplazarlos antes de radicar el listado que después.
 */
export function AlertaCensoTestigos({ testigos }: Props) {
  if (testigos.length === 0) return null

  return (
    <div style={{
      background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px',
      padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
    }}>
      <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.95rem' }}>
        {testigos.length === 1
          ? '1 testigo sin confirmar en el censo electoral'
          : `${testigos.length} testigos sin confirmar en el censo electoral`}
      </div>
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#78350f', lineHeight: 1.5 }}>
        Si su cédula no aparece inscrita, la Registraduría puede rechazarlos. Los que
        están sin verificar se consultan desde Electores → Verificar padrón en el censo.
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem', color: '#78350f' }}>
        {testigos.map((t, i) => (
          <li key={i}>{t.nombre} — {t.estado ? ETIQUETA[t.estado] ?? t.estado : 'sin verificar'}</li>
        ))}
      </ul>
    </div>
  )
}
