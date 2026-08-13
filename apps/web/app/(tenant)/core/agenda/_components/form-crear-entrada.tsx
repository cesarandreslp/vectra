'use client'

import { useState } from 'react'
import { crearEntradaAgendaAdmin } from '../actions'

const input = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }

/** Alta de un hueco disponible o un compromiso privado en la agenda de un anfitrión. */
export function FormCrearEntrada({ anfitrionId, onCreada }: { anfitrionId: string; onCreada: () => void }) {
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [disponible, setDisponible] = useState(true)
  const [titulo, setTitulo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    const r = await crearEntradaAgendaAdmin(anfitrionId, { startsAt, endsAt, disponible, titulo: titulo || undefined })
    setGuardando(false)
    if (!r.success) { setError(r.error ?? 'No se pudo crear.'); return }
    setStartsAt(''); setEndsAt(''); setTitulo('')
    onCreada()
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Agregar a la agenda</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          Inicio
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required style={input} />
        </label>
        <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          Fin
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required style={input} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem' }}>
        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <input type="radio" checked={disponible} onChange={() => setDisponible(true)} /> Hueco disponible (reservable)
        </label>
        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <input type="radio" checked={!disponible} onChange={() => setDisponible(false)} /> Compromiso
        </label>
      </div>
      {!disponible && (
        <input placeholder="Título del compromiso" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={input} />
      )}
      {error && <div style={{ color: '#dc2626', fontSize: '0.8rem' }}>{error}</div>}
      <button type="submit" disabled={guardando} style={{ alignSelf: 'flex-start', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.45rem 0.9rem', fontSize: '0.85rem', cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
        {guardando ? 'Guardando…' : 'Agregar'}
      </button>
    </form>
  )
}
