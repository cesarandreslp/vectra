'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { crearActividad, eliminarActividad, type ActividadResumen } from '../actions'
import { DetalleActividad, type Elector } from './detalle-actividad'

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }
const input = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 0.65rem', fontSize: '0.85rem' }
const btn = { background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.9rem', fontSize: '0.85rem', cursor: 'pointer' }

export function PanelActividades({ actividades, electores }: { actividades: ActividadResumen[]; electores: Elector[] }) {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('')
  const [fecha, setFecha] = useState('')
  const [sel, setSel] = useState<string | null>(null)

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    const r = await crearActividad({ nombre, categoria: categoria || undefined, fecha: fecha || undefined })
    if (!r.success) { alert(r.error); return }
    setNombre(''); setCategoria(''); setFecha(''); router.refresh()
  }
  async function borrar(id: string) {
    if (!confirm('¿Borrar la actividad y todos sus grupos, miembros e insumos?')) return
    const r = await eliminarActividad(id)
    if (!r.success) { alert(r.error); return }
    if (sel === id) setSel(null)
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <form onSubmit={crear} style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'flex-end' }}>
        <label style={lbl}>Actividad<input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Brigada de salud" required style={input} /></label>
        <label style={lbl}>Categoría<input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="salud, mascotas…" style={input} /></label>
        <label style={lbl}>Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={input} /></label>
        <button type="submit" style={btn}>Crear actividad</button>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
        {actividades.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Todavía no hay actividades.</div>}
        {actividades.map((a) => (
          <div key={a.id} onClick={() => setSel(a.id)} style={{ ...card, cursor: 'pointer', borderColor: sel === a.id ? '#16a34a' : '#e2e8f0', outline: sel === a.id ? '1px solid #16a34a' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.95rem' }}>{a.nombre}</strong>
              <button onClick={(e) => { e.stopPropagation(); borrar(a.id) }} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer' }}>Borrar</button>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              {a.categoria ? `${a.categoria} · ` : ''}{a.fecha ? new Date(a.fecha).toLocaleDateString('es-CO') : 'sin fecha'} · {a.estado}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.4rem' }}>
              {a.grupos} grupo(s) · {a.simpatizantes} simpatizante(s) · {a.insumos} insumo(s)
            </div>
          </div>
        ))}
      </div>

      {sel && <DetalleActividad actividadId={sel} electores={electores} />}
    </div>
  )
}

const lbl = { display: 'flex', flexDirection: 'column' as const, gap: '0.2rem', fontSize: '0.75rem', color: '#64748b' }
