'use client'

import { useState } from 'react'
import { crearMiGrupo, type MiActividad } from '../actions'
import { GrupoDoliente } from './grupo-doliente'

export type ElectorOption = { id: string; name: string; esSimpatizante: boolean }

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.9rem' }
const input = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' as const }

export function PanelMisActividades({ actividades, electores, onChange }: {
  actividades: MiActividad[]; electores: ElectorOption[]; onChange: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {actividades.map((a) => <Actividad key={a.id} a={a} electores={electores} onChange={onChange} />)}
    </div>
  )
}

function Actividad({ a, electores, onChange }: { a: MiActividad; electores: ElectorOption[]; onChange: () => void }) {
  const [nombre, setNombre] = useState('')
  const [lugar, setLugar] = useState('')
  const [inicio, setInicio] = useState('')
  const [horas, setHoras] = useState('')
  const [abierto, setAbierto] = useState(false)

  async function agregarGrupo(e: React.FormEvent) {
    e.preventDefault()
    const r = await crearMiGrupo(a.id, {
      nombre, lugar: lugar || undefined, inicio: inicio || undefined,
      duracionMin: horas ? Math.round(Number(horas) * 60) : undefined,
    })
    if (!r.success) { alert(r.error); return }
    setNombre(''); setLugar(''); setInicio(''); setHoras(''); setAbierto(false); onChange()
  }

  return (
    <div style={card}>
      <strong style={{ fontSize: '1rem' }}>{a.nombre}</strong>
      <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '0.15rem' }}>
        {a.categoria ? `${a.categoria} · ` : ''}{a.fecha ? new Date(a.fecha).toLocaleDateString('es-CO') : 'sin fecha'} · {a.estado.replace('_', ' ').toLowerCase()}
      </div>

      <div style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>
        <span style={{
          border: `1px solid ${a.presupuestoAprobado ? '#16a34a' : '#d97706'}`,
          color: a.presupuestoAprobado ? '#16a34a' : '#d97706',
          borderRadius: 999, padding: '0.05rem 0.5rem',
        }}>
          {a.presupuestoAprobado ? 'presupuesto aprobado' : 'esperando aprobación de finanzas'}
        </span>
        <span style={{ color: '#94a3b8', marginLeft: '0.4rem' }}>${a.presupuesto.toLocaleString('es-CO')}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
        {a.grupos.map((g) => <GrupoDoliente key={g.id} grupo={g} electores={electores} onChange={onChange} />)}
      </div>

      {!abierto && (
        <button onClick={() => setAbierto(true)} style={{ ...btnOscuro, marginTop: '0.7rem', width: '100%' }}>+ Agregar un lugar</button>
      )}
      {abierto && (
        <form onSubmit={agregarGrupo} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.7rem', background: '#f8fafc', borderRadius: '8px', padding: '0.6rem' }}>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Lugar (ej: Parque San José)" required style={input} />
          <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Dirección o referencia" style={input} />
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} style={input} />
            <input type="number" min={0.5} step={0.5} value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="horas" style={{ ...input, width: '5rem' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="submit" style={{ ...btnOscuro, flex: 1 }}>Guardar</button>
            <button type="button" onClick={() => setAbierto(false)} style={{ ...btnOscuro, flex: 1, background: '#fff', color: '#64748b', border: '1px solid #cbd5e1' }}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}

const btnOscuro = { background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 0.9rem', fontSize: '0.85rem', cursor: 'pointer' }
