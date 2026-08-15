import { getLogisticaDia } from './actions'
import { SelectorFechaLogistica } from './_components/selector-fecha'

export const metadata = { title: 'Logística' }

interface Props {
  searchParams: Promise<{ fecha?: string }>
}

function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function LogisticaPage({ searchParams }: Props) {
  const { fecha } = await searchParams
  const fechaSeleccionada = fecha || hoyISO()
  const datos = await getLogisticaDia(fechaSeleccionada)

  const totalReuniones = datos.convocatorias.length + datos.reclutamiento.length

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Logística</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        Reuniones del día — cuántas hay, dónde, cuántos asisten y qué comida hace falta.
      </p>

      <SelectorFechaLogistica fecha={fechaSeleccionada} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', margin: '1.25rem 0' }}>
        <Tarjeta label="Reuniones" valor={String(totalReuniones)} />
        <Tarjeta label="Desayunos" valor={String(datos.totalesPorComida.DESAYUNO)} />
        <Tarjeta label="Almuerzos" valor={String(datos.totalesPorComida.ALMUERZO)} />
        <Tarjeta label="Cenas" valor={String(datos.totalesPorComida.CENA)} />
        <Tarjeta label="Refrigerios" valor={String(datos.totalesPorComida.REFRIGERIO)} />
      </div>

      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '1.5rem 0 0.75rem' }}>Convocadas por el equipo</h2>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        {datos.convocatorias.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>Sin convocatorias ese día.</div>
        ) : (
          datos.convocatorias.map((c) => (
            <div key={c.id} style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.titulo}</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {new Date(c.startsAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} · {c.direccion ?? c.lugar ?? 'sin dirección'} · {c.totalDestinatarios} convocado(s)
                </div>
              </div>
              <span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600 }}>
                {c.tipoComidaLabel} · {c.totalDestinatarios}
              </span>
            </div>
          ))
        )}
      </div>

      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '1.5rem 0 0.75rem' }}>Reclutamiento (organizadas por electores)</h2>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        {datos.reclutamiento.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>Sin reuniones de reclutamiento ese día.</div>
        ) : (
          datos.reclutamiento.map((r) => (
            <div key={r.id} style={{ padding: '0.85rem 1.1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.titulo}</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  organiza {r.organizadorName} · {r.totalProspectos} prospecto(s)
                </div>
              </div>
              <span style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600 }}>
                {r.tipoComidaLabel} · {r.totalProspectos}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Tarjeta({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{valor}</div>
    </div>
  )
}
