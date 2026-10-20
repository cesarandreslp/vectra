'use client'

/**
 * Al imprimir solo sale `.area-impresion` (sin menú lateral ni barra superior)
 * y se ocultan los botones (`.no-imprimir`).
 */
export const ESTILO_IMPRESION = `
@media print {
  body * { visibility: hidden; }
  .area-impresion, .area-impresion * { visibility: visible; }
  .area-impresion { position: absolute; left: 0; top: 0; width: 100%; }
  .no-imprimir { display: none !important; }
}
`

export function BotonImprimir({ texto = 'Imprimir / PDF' }: { texto?: string }) {
  return (
    <button
      type="button" onClick={() => window.print()}
      style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
    >
      {texto}
    </button>
  )
}
