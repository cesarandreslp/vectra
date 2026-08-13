'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { aprobarPresupuesto, revocarPresupuesto, type PresupuestoActividad } from '../actions'

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }
const pesos = (n: number) => `$${n.toLocaleString('es-CO')}`

export function PanelPresupuestos({ pendientes, aprobados }: { pendientes: PresupuestoActividad[]; aprobados: PresupuestoActividad[] }) {
  const router = useRouter()
  const [abierta, setAbierta] = useState<string | null>(null)

  const accion = async (p: Promise<{ success: boolean; error?: string }>) => {
    const r = await p
    if (!r.success) { alert(r.error); return }
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Pendientes de aprobación ({pendientes.length})</h2>
        {pendientes.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No hay presupuestos esperando.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {pendientes.map((a) => (
            <Ficha key={a.id} a={a} abierta={abierta === a.id} onToggle={() => setAbierta(abierta === a.id ? null : a.id)}>
              <button onClick={() => accion(aprobarPresupuesto(a.id))} style={btnVerde}>Aprobar presupuesto</button>
            </Ficha>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Aprobados ({aprobados.length})</h2>
        {aprobados.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Todavía no aprobaste ninguno.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {aprobados.map((a) => (
            <Ficha key={a.id} a={a} abierta={abierta === a.id} onToggle={() => setAbierta(abierta === a.id ? null : a.id)}>
              <button onClick={() => accion(revocarPresupuesto(a.id))} style={btnGris}>Revocar</button>
            </Ficha>
          ))}
        </div>
      </section>
    </div>
  )
}

function Ficha({ a, abierta, onToggle, children }: { a: PresupuestoActividad; abierta: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ ...card, borderColor: a.aprobado ? '#bbf7d0' : '#fed7aa' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <strong style={{ fontSize: '0.95rem' }}>{a.nombre}</strong>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem' }}>
            {a.categoria ? `${a.categoria} · ` : ''}{a.fecha ? new Date(a.fecha).toLocaleDateString('es-CO') : 'sin fecha'} · doliente: {a.doliente}
          </div>
          {a.aprobado && a.aprobadoEn && (
            <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.2rem' }}>
              Aprobado por {a.aprobadoPor} el {new Date(a.aprobadoEn).toLocaleDateString('es-CO')}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{pesos(a.total)}</div>
          <button onClick={onToggle} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>
            {abierta ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
        </div>
      </div>

      {abierta && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem' }}>
          {a.grupos.map((g, gi) => (
            <div key={gi} style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{g.nombre}{g.lugar ? ` · ${g.lugar}` : ''}</div>
              {g.insumos.length === 0 && <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>sin insumos</div>}
              {g.insumos.map((i, ii) => (
                <div key={ii} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569' }}>
                  <span>{i.cantidad}× {i.descripcion} <span style={{ color: '#94a3b8' }}>({i.tipo.toLowerCase()})</span></span>
                  <span>{i.costoEstimado != null ? pesos(i.costoEstimado * i.cantidad) : 'sin costo'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '0.75rem' }}>{children}</div>
    </div>
  )
}

const btnVerde = { background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.9rem', fontSize: '0.85rem', cursor: 'pointer' }
const btnGris  = { background: '#fff', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }
