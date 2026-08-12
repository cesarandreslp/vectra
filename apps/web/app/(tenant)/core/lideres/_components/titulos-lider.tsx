import { TITULOS, type TituloLider } from '@/lib/lideres'

/**
 * Distintivos de los títulos ganados. Son dos ejes independientes —
 * reclutamiento propio y red construida — así que alguien puede llevar los dos,
 * uno o ninguno. Ver lib/lideres.ts.
 */
export function TitulosLider({ titulos }: { titulos: TituloLider[] }) {
  if (titulos.length === 0) return null

  return (
    <span style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
      {titulos.map((t) => (
        <span
          key={t}
          title={TITULOS[t].descripcion}
          style={{
            fontSize: '0.68rem', fontWeight: 600, lineHeight: 1.6,
            padding: '0 0.45rem', borderRadius: '999px', whiteSpace: 'nowrap',
            color: TITULOS[t].color,
            border: `1px solid ${TITULOS[t].color}33`,
            background: `${TITULOS[t].color}14`,
          }}
        >
          {TITULOS[t].nombre}
        </span>
      ))}
    </span>
  )
}
