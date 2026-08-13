'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getActividadDetalle, crearGrupo, cambiarEstadoActividad, type ActividadDetalle } from '../actions'

type EstadoActividad = 'PLANEADA' | 'EN_CURSO' | 'REALIZADA' | 'CANCELADA'
import { GrupoCard } from './grupo-card'

export type Elector = { id: string; name: string; esSimpatizante: boolean }

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }
const input = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 0.65rem', fontSize: '0.85rem' }

export function DetalleActividad({ actividadId, electores }: { actividadId: string; electores: Elector[] }) {
  const router = useRouter()
  const [detalle, setDetalle] = useState<ActividadDetalle | null>(null)
  const [nombre, setNombre] = useState('')
  const [lugar, setLugar] = useState('')
  const [responsableId, setResponsableId] = useState('')

  // refresh() además del fetch: los contadores de la tarjeta y la marca ·simp de
  // la lista de electores vienen del render del servidor, y si no, quedan viejos.
  const cargar = useCallback(() => {
    void getActividadDetalle(actividadId).then(setDetalle)
    router.refresh()
  }, [actividadId, router])
  useEffect(() => { cargar() }, [cargar])

  if (!detalle) return <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Cargando…</div>

  async function addGrupo(e: React.FormEvent) {
    e.preventDefault()
    const r = await crearGrupo(actividadId, { nombre, lugar: lugar || undefined, responsableId: responsableId || undefined })
    if (!r.success) { alert(r.error); return }
    setNombre(''); setLugar(''); setResponsableId(''); cargar()
  }

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{detalle.nombre} — grupos y logística</h2>
      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '-0.6rem' }}>Doliente: {detalle.doliente}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Estado:</span>
        <select
          value={detalle.estado}
          onChange={async (e) => {
            const r = await cambiarEstadoActividad(actividadId, e.target.value as EstadoActividad)
            if (!r.success) alert(r.error)
            cargar()
          }}
          style={{ ...input, padding: '0.3rem 0.5rem' }}
        >
          {(['PLANEADA', 'EN_CURSO', 'REALIZADA', 'CANCELADA'] as const).map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}
        </select>
        {!detalle.presupuestoAprobado && (
          <span style={{ fontSize: '0.75rem', color: '#d97706' }}>
            No puede ejecutarse: el presupuesto todavía no lo aprobó el área financiera.
          </span>
        )}
      </div>

      <form onSubmit={addGrupo} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'flex-end', background: '#f8fafc', borderRadius: '8px', padding: '0.75rem' }}>
        <label style={lbl}>Grupo / lugar<input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Parque San José" required style={input} /></label>
        <label style={lbl}>Referencia<input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="dirección / punto" style={input} /></label>
        <label style={lbl}>Responsable
          <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} style={input}>
            <option value="">(opcional)</option>
            {electores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <button type="submit" style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.9rem', fontSize: '0.85rem', cursor: 'pointer' }}>+ Grupo</button>
      </form>

      {detalle.grupos.length === 0 && (
        <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sin grupos todavía. Agregá uno por cada lugar donde se ejecute la actividad.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {detalle.grupos.map((g) => <GrupoCard key={g.id} grupo={g} electores={electores} onChange={cargar} />)}
      </div>
    </div>
  )
}

const lbl = { display: 'flex', flexDirection: 'column' as const, gap: '0.2rem', fontSize: '0.75rem', color: '#64748b' }
