import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMesaEscrutinio, getMotivos } from '../actions'
import { FormEscrutinio } from '../_components/form-escrutinio'

export const metadata = { title: 'Escrutinio de mesa' }

interface Props {
  params: Promise<{ mesaId: string }>
}

export default async function MesaEscrutinioPage({ params }: Props) {
  const { mesaId } = await params
  const [mesa, motivos] = await Promise.all([getMesaEscrutinio(mesaId), getMotivos()])
  if (!mesa) notFound()

  return (
    <div style={{ maxWidth: 760 }}>
      <Link href="/dia-e/escrutinio" style={{ color: '#64748b', fontSize: '0.875rem', textDecoration: 'none' }}>← Escrutinio</Link>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.5rem 0 0.25rem' }}>{mesa.puesto} — Mesa {mesa.mesa}</h1>
      <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
        {mesa.filas.some((f) => f.e14 !== null)
          ? 'A la izquierda, lo que transmitió el testigo de mesa (E-14). Corrige lo que cambió en la comisión.'
          : 'Esta mesa no tiene E-14 transmitido: digita lo que dejó la comisión.'}
      </p>

      <FormEscrutinio mesa={mesa} motivos={motivos} />

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
