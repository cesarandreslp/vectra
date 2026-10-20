import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMesaEscrutinio, getMotivos, listMesasEscrutinio } from '../actions'
import { FormEscrutinio } from '../_components/form-escrutinio'

export const metadata = { title: 'Escrutinio de mesa' }

interface Props {
  params:       Promise<{ mesaId: string }>
  searchParams: Promise<{ zona?: string }>
}

export default async function MesaEscrutinioPage({ params, searchParams }: Props) {
  const { mesaId } = await params
  const { zona } = await searchParams
  const [mesa, motivos, lista] = await Promise.all([getMesaEscrutinio(mesaId), getMotivos(), listMesasEscrutinio(zona || null)])
  if (!mesa) notFound()

  // Recorrer las mesas de la zona en orden (puesto, mesa), como las lee la comisión.
  const i = lista.mesas.findIndex((m) => m.id === mesaId)
  const enlace = (id: string | undefined) => (id ? `/dia-e/escrutinio/${id}${zona ? `?zona=${zona}` : ''}` : null)
  const anterior  = enlace(lista.mesas[i - 1]?.id)
  const siguiente = enlace(lista.mesas[i + 1]?.id)

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
        <Link href={`/dia-e/escrutinio${zona ? `?zona=${zona}` : ''}`} style={{ color: '#64748b', textDecoration: 'none' }}>← Lista de mesas</Link>
        <span style={{ display: 'flex', gap: '1rem' }}>
          {anterior && <Link href={anterior} style={{ color: '#1e40af', textDecoration: 'none' }}>← Mesa anterior</Link>}
          {i >= 0 && <span style={{ color: '#94a3b8' }}>{i + 1} de {lista.mesas.length}</span>}
          {siguiente && <Link href={siguiente} style={{ color: '#1e40af', textDecoration: 'none' }}>Siguiente →</Link>}
        </span>
      </div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.5rem 0 0.25rem' }}>Formulario E-24 · {mesa.puesto} — Mesa {mesa.mesa}</h1>
      <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
        {mesa.filas.some((f) => f.e14 !== null)
          ? 'Preconteo: lo que transmitió el testigo de mesa (E-14). Llena la corrección solo en los datos que la comisión cambió; lo demás queda con el preconteo.'
          : 'Esta mesa no tiene E-14 transmitido: digita lo que dejó la comisión.'}
      </p>

      <FormEscrutinio key={mesa.id} mesa={mesa} motivos={motivos} siguienteHref={siguiente} />

      {mesa.historial.length > 0 && (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Historial de correcciones</h2>
          {[...mesa.historial].reverse().map((h, i) => (
            <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.6rem 0.8rem', marginBottom: '0.5rem', background: '#fff', fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 600 }}>{h.motivo} <span style={{ color: '#94a3b8', fontWeight: 400 }}>· {h.por} · {new Date(h.at).toLocaleString('es-CO')}</span></div>
              {h.observacion && <div style={{ color: '#475569', marginTop: 2 }}>{h.observacion}</div>}
              <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem', color: '#334155' }}>
                {h.cambios.map((c) => (
                  <li key={c.clave}>{mesa.filas.find((f) => f.clave === c.clave)?.nombre ?? c.clave}: {c.antes} → {c.despues}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
