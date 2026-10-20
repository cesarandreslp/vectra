import Link from 'next/link'
import { getFormE26 } from '../actions'
import { FormE26 } from '../_components/form-e26'

export const metadata = { title: 'Formulario E-26' }

interface Props {
  searchParams: Promise<{ zona?: string }>
}

/**
 * Cotejo del E-26 oficial: el consolidado del escrutinio que llevó la campaña
 * (E-24) frente a lo que dejó la comisión en su acta. Se digita solo lo que el
 * acta trae distinto; las diferencias son lo que hay que reclamar.
 */
export default async function FormularioE26Page({ searchParams }: Props) {
  const { zona } = await searchParams
  const form = await getFormE26(zona || null)

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
        <Link href="/dia-e/escrutinio" style={{ color: '#64748b', textDecoration: 'none' }}>← Formulario E-24</Link>
        <Link href={`/core/reportes/e26${zona ? `?zona=${zona}` : ''}`} style={{ color: '#1e40af' }}>Acta E-26 para imprimir</Link>
      </div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.5rem 0 0.25rem' }}>Formulario E-26 (cotejo del acta oficial)</h1>
      <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Con el E-26 de la comisión en la mano, digita en la columna del acta <b>solo los valores que no coinciden</b> con
        nuestro escrutinio (E-24). Lo que dejes vacío se toma igual. Las diferencias quedan marcadas para reclamar.
      </p>

      <form method="GET" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select name="zona" defaultValue={zona ?? ''} style={{ padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.85rem' }}>
          <option value="">E-26 general — todo el municipio</option>
          {form.zonas.map((z) => <option key={z.id} value={z.id}>E-26 parcial — Zona {z.code}{z.name ? ` (${z.name})` : ''}</option>)}
        </select>
        <button type="submit" style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
          Cambiar
        </button>
        <span style={{ fontSize: '0.8rem', color: form.mesasRevisadas < form.mesasTotales ? '#92400e' : '#64748b' }}>
          Escrutinio: {form.mesasRevisadas} de {form.mesasTotales} mesas revisadas
          {form.mesasRevisadas < form.mesasTotales && ' — las pendientes van con su E-14'}
        </span>
      </form>

      <FormE26 key={form.zonaActual?.id ?? 'general'} form={form} />
    </div>
  )
}
