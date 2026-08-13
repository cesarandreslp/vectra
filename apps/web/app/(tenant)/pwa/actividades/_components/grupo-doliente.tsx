'use client'

import { useState } from 'react'
import { agregarMiMiembro, quitarMiMiembro, agregarMiInsumo, eliminarMiInsumo, eliminarMiGrupo, type MiActividad } from '../actions'
import type { ElectorOption } from './panel-mis-actividades'

type Grupo = MiActividad['grupos'][number]

const TIPOS = ['ALIMENTACION', 'INSUMO', 'MATERIAL', 'HERRAMIENTA'] as const
const COLOR_ESTADO: Record<string, string> = { REQUERIDO: '#d97706', APROBADO: '#2563eb', CONSEGUIDO: '#16a34a' }
const input = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.35rem 0.55rem', fontSize: '0.8rem' }

const reloj = (d: Date) => d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function franja(g: Grupo): string {
  if (!g.inicio || !g.duracionMin) return 'sin horario — no se controlan cruces'
  const desde = new Date(g.inicio)
  return `${reloj(desde)} → ${reloj(new Date(desde.getTime() + g.duracionMin * 60_000))}`
}

export function GrupoDoliente({ grupo, electores, onChange }: { grupo: Grupo; electores: ElectorOption[]; onChange: () => void }) {
  const [electorId, setElectorId] = useState('')
  const [desc, setDesc] = useState('')
  const [tipo, setTipo] = useState<typeof TIPOS[number]>('INSUMO')
  const [cant, setCant] = useState(1)
  const [costo, setCosto] = useState('')

  const wrap = async (p: Promise<{ success: boolean; error?: string }>) => {
    const r = await p
    if (!r.success) alert(r.error)
    onChange()
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.7rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div>
          <strong style={{ fontSize: '0.9rem' }}>{grupo.nombre}</strong>
          {grupo.lugar && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{grupo.lugar}</div>}
          <div style={{ fontSize: '0.73rem', color: grupo.inicio ? '#475569' : '#d97706' }}>{franja(grupo)}</div>
        </div>
        <button onClick={() => confirm('¿Borrar este lugar?') && wrap(eliminarMiGrupo(grupo.id))} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer' }}>Borrar</button>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <div style={{ fontSize: '0.76rem', fontWeight: 600, marginBottom: '0.25rem' }}>Quiénes van ({grupo.miembros.length})</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.35rem' }}>
          {grupo.miembros.map((m) => (
            <span key={m.id} style={{ background: '#f1f5f9', borderRadius: 999, padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
              {m.name} <button onClick={() => wrap(quitarMiMiembro(m.id))} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <select value={electorId} onChange={(e) => setElectorId(e.target.value)} style={{ ...input, flex: 1, minWidth: 0 }}>
            <option value="">Sumar a alguien…</option>
            {electores.filter((v) => !grupo.miembros.some((m) => m.name === v.name)).map((v) => (
              <option key={v.id} value={v.id}>{v.name}{v.esSimpatizante ? ' ·simp' : ''}</option>
            ))}
          </select>
          <button disabled={!electorId} onClick={() => { wrap(agregarMiMiembro(grupo.id, electorId)); setElectorId('') }} style={{ ...input, background: '#0f172a', color: '#fff', border: 'none', cursor: 'pointer', opacity: electorId ? 1 : 0.5 }}>+</button>
        </div>
      </div>

      <div style={{ marginTop: '0.6rem' }}>
        <div style={{ fontSize: '0.76rem', fontWeight: 600, marginBottom: '0.25rem' }}>Qué hace falta</div>
        {grupo.insumos.map((i) => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', borderBottom: '1px solid #f1f5f9', padding: '0.2rem 0' }}>
            <span style={{ flex: 1 }}>{i.cantidad}× {i.descripcion} <span style={{ color: '#94a3b8' }}>({i.tipo.toLowerCase()}{i.costoEstimado != null ? ` · $${i.costoEstimado.toLocaleString('es-CO')}` : ''})</span></span>
            <span style={{ color: COLOR_ESTADO[i.estado], fontSize: '0.68rem' }}>{i.estado}</span>
            <button onClick={() => wrap(eliminarMiInsumo(i.id))} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.35rem' }}>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Qué falta…" style={{ ...input, flex: 1, minWidth: '110px' }} />
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof TIPOS[number])} style={input}>
            {TIPOS.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}
          </select>
          <input type="number" min={1} value={cant} onChange={(e) => setCant(Number(e.target.value))} style={{ ...input, width: '3.2rem' }} />
          <input type="number" min={0} value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="$" style={{ ...input, width: '4.5rem' }} />
          <button disabled={!desc.trim()} onClick={() => { wrap(agregarMiInsumo(grupo.id, { descripcion: desc, tipo, cantidad: cant, costoEstimado: costo ? Number(costo) : undefined })); setDesc(''); setCant(1); setCosto('') }} style={{ ...input, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', opacity: desc.trim() ? 1 : 0.5 }}>+</button>
        </div>
      </div>
    </div>
  )
}
