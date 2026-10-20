import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDatosE26 } from '../actions'
import { BotonImprimir, ESTILO_IMPRESION } from '../_components/imprimir'
import { ActaE26, CORPORACIONES } from './_components/acta-e26'

export const metadata = { title: 'Consolidado E-26' }

interface Props {
  searchParams: Promise<{ zona?: string; curules?: string }>
}

/**
 * Consolidado de escrutinio en formato E-26, armado con los E-14 que
 * transmitieron nuestros testigos. El E-26 oficial lo expide la comisión
 * escrutadora (auxiliar por zona → parcial; municipal → general, con la
 * declaratoria de elección); este sirve para cotejarlo mesa a mesa y sustentar
 * reclamaciones donde no cuadre.
 */
export default async function E26Page({ searchParams }: Props) {
  const params = await searchParams
  const datos = await getDatosE26(params.zona || null)
  if (!datos) notFound()

  const esCorporacion = datos.cargo !== null && CORPORACIONES.includes(datos.cargo)
  const curules = Number(params.curules)

  return (
    <div>
      <style>{ESTILO_IMPRESION}</style>
      <Link href="/core/reportes" className="no-imprimir" style={{ color: '#64748b', fontSize: '0.875rem', textDecoration: 'none' }}>
        ← Reportes
      </Link>

      <form method="GET" className="no-imprimir" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', margin: '0.75rem 0 1.25rem' }}>
        <label style={etiqueta}>
          Alcance
          <select name="zona" defaultValue={params.zona ?? ''} style={campo}>
            <option value="">General — todo el municipio</option>
            {datos.zonas.map((z) => <option key={z.id} value={z.id}>Parcial — Zona {z.code}{z.name ? ` (${z.name})` : ''}</option>)}
          </select>
        </label>
        {esCorporacion && (
          <label style={etiqueta}>
            Curules a proveer
            <input name="curules" type="number" min={1} defaultValue={params.curules ?? ''} placeholder="Ej: 17" style={{ ...campo, width: 110 }} />
          </label>
        )}
        <button type="submit" style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
          Generar
        </button>
        <BotonImprimir />
      </form>
      {esCorporacion && !(curules >= 1) && (
        <p className="no-imprimir" style={{ fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
          Indica las curules para calcular umbral, cifra repartidora y curules por agrupación. Concejos (Ley 136 de 1994, por población):
          hasta 5.000 hab. 7 · 5.001–10.000: 9 · 10.001–20.000: 11 · 20.001–50.000: 13 · 50.001–100.000: 15 · 100.001–250.000: 17 · 250.001–1.000.000: 19 · más de 1.000.000: 21.
        </p>
      )}

      <ActaE26 datos={datos} curules={esCorporacion && curules >= 1 ? Math.floor(curules) : null} />
    </div>
  )
}

const etiqueta: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem', color: '#475569', fontWeight: 600 }
const campo: React.CSSProperties = { padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.85rem', background: '#fff' }
