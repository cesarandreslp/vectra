'use client'

import { useState } from 'react'
import {
  eliminarGrupo, agregarMiembro, quitarMiembro, agregarInsumo, eliminarInsumo, cambiarEstadoInsumo,
} from '../actions'
import type { Elector } from './detalle-actividad'

type Grupo = {
  id: string; nombre: string; lugar: string | null; responsableName: string | null
  miembros: { id: string; voterId: string; name: string }[]
  insumos: { id: string; descripcion: string; tipo: string; cantidad: number; costoEstimado: number | null; estado: string }[]
}

const TIPOS = ['ALIMENTACION', 'INSUMO', 'MATERIAL', 'HERRAMIENTA'] as const
const COLOR_ESTADO: Record<string, string> = { REQUERIDO: '#d97706', APROBADO: '#2563eb', CONSEGUIDO: '#16a34a' }
const SIGUIENTE: Record<string, 'REQUERIDO' | 'APROBADO' | 'CONSEGUIDO'> = { REQUERIDO: 'APROBADO', APROBADO: 'CONSEGUIDO', CONSEGUIDO: 'REQUERIDO' }
const input = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.35rem 0.55rem', fontSize: '0.8rem' }

export function GrupoCard({ grupo, electores, onChange }: { grupo: Grupo; electores: Elector[]; onChange: () => void }) {
  const [voterId, setVoterId] = useState('')
  const [desc, setDesc] = useState('')
  const [tipo, setTipo] = useState<typeof TIPOS[number]>('INSUMO')
  const [cant, setCant] = useState(1)
  const [costo, setCosto] = useState('')

  const wrap = async (p: Promise<{ success: boolean; error?: string }>) => { const r = await p; if (!r.success) alert(r.error); onChange() }
  const enGrupo = new Set(grupo.miembros.map((m) => m.voterId))

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
        <div>
          <strong>{grupo.nombre}</strong>
          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{grupo.lugar ? ` · ${grupo.lugar}` : ''}{grupo.responsableName ? ` · resp: ${grupo.responsableName}` : ''}</span>
        </div>
        <button onClick={() => confirm('¿Borrar el grupo?') && wrap(eliminarGrupo(grupo.id))} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer' }}>Borrar grupo</button>
      </div>

      {/* Miembros (simpatizantes) */}
      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Simpatizantes ({grupo.miembros.length})</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
          {grupo.miembros.map((m) => (
            <span key={m.id} style={{ background: '#f1f5f9', borderRadius: 999, padding: '0.15rem 0.5rem', fontSize: '0.76rem' }}>
              {m.name} <button onClick={() => wrap(quitarMiembro(m.id))} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <select value={voterId} onChange={(e) => setVoterId(e.target.value)} style={{ ...input, flex: 1 }}>
            <option value="">Agregar simpatizante…</option>
            {electores.filter((v) => !enGrupo.has(v.id)).map((v) => <option key={v.id} value={v.id}>{v.name}{v.esSimpatizante ? ' ·simp' : ''}</option>)}
          </select>
          <button disabled={!voterId} onClick={() => { wrap(agregarMiembro(grupo.id, voterId)); setVoterId('') }} style={{ ...input, cursor: 'pointer', background: '#0f172a', color: '#fff', border: 'none', opacity: voterId ? 1 : 0.5 }}>+</button>
        </div>
      </div>

      {/* Insumos (logística) */}
      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Logística</div>
        {grupo.insumos.map((i) => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', borderBottom: '1px solid #f1f5f9', padding: '0.25rem 0' }}>
            <span style={{ flex: 1 }}>{i.cantidad}× {i.descripcion} <span style={{ color: '#94a3b8' }}>({i.tipo.toLowerCase()}{i.costoEstimado != null ? ` · $${i.costoEstimado.toLocaleString('es-CO')}` : ''})</span></span>
            <button onClick={() => wrap(cambiarEstadoInsumo(i.id, SIGUIENTE[i.estado]))} title="Cambiar estado (tesorero aprueba)" style={{ border: `1px solid ${COLOR_ESTADO[i.estado]}`, color: COLOR_ESTADO[i.estado], background: '#fff', borderRadius: 999, padding: '0.05rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer' }}>{i.estado}</button>
            <button onClick={() => wrap(eliminarInsumo(i.id))} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Insumo / material…" style={{ ...input, flex: 1, minWidth: '120px' }} />
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof TIPOS[number])} style={input}>{TIPOS.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}</select>
          <input type="number" min={1} value={cant} onChange={(e) => setCant(Number(e.target.value))} style={{ ...input, width: '3.5rem' }} />
          <input type="number" min={0} value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="$ costo" style={{ ...input, width: '5rem' }} />
          <button disabled={!desc.trim()} onClick={() => { wrap(agregarInsumo(grupo.id, { descripcion: desc, tipo, cantidad: cant, costoEstimado: costo ? Number(costo) : undefined })); setDesc(''); setCant(1); setCosto('') }} style={{ ...input, cursor: 'pointer', background: '#16a34a', color: '#fff', border: 'none', opacity: desc.trim() ? 1 : 0.5 }}>+ Insumo</button>
        </div>
      </div>
    </div>
  )
}
