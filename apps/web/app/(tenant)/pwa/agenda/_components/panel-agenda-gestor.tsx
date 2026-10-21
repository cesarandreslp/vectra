'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getMiGestion, getAgendaGestionada, crearEntradaGestionada, toggleAbiertaGestionada,
  type EntradaAgenda,
} from '../actions'
import { CalendarioMensual } from '@/app/_components/calendario-mensual'
import { ItemEntradaAgenda, eventoDeEntrada, entradasDelDia } from '@/app/_components/entrada-agenda'

type Gestion = NonNullable<Awaited<ReturnType<typeof getMiGestion>>>

const inp = { border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px' }

export function PanelAgendaGestor({ inicial }: { inicial: Gestion }) {
  const [anfitriones, setAnfitriones] = useState(inicial.anfitriones)
  const [anfitrionId, setAnfitrionId] = useState(inicial.anfitriones[0]?.id ?? '')
  const [entradas, setEntradas] = useState<EntradaAgenda[]>([])
  const [dia, setDia] = useState<Date | null>(null)
  const [disponible, setDisponible] = useState(true)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [titulo, setTitulo] = useState('')

  const cargar = useCallback(() => { if (anfitrionId) void getAgendaGestionada(anfitrionId).then(setEntradas) }, [anfitrionId])
  useEffect(() => { setDia(null); cargar() }, [anfitrionId, cargar])

  const anfitrion = anfitriones.find((a) => a.id === anfitrionId)

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    const r = await crearEntradaGestionada(anfitrionId, { startsAt, endsAt, disponible, titulo: titulo || undefined })
    if (!r.success) { alert(r.error); return }
    setStartsAt(''); setEndsAt(''); setTitulo(''); cargar()
  }
  async function toggle() {
    if (!anfitrion) return
    const r = await toggleAbiertaGestionada(anfitrionId, !anfitrion.agendaAbierta)
    if (!r.success) { alert(r.error); return }
    const g = await getMiGestion(); if (g) setAnfitriones(g.anfitriones)
  }

  const eventos = entradas.map(eventoDeEntrada)
  const delDia = entradasDelDia(entradas, dia)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {anfitriones.length > 1 && (
        <select value={anfitrionId} onChange={(e) => setAnfitrionId(e.target.value)} style={inp}>
          {anfitriones.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}

      {anfitrion?.isCandidate && (
        <div style={{ ...card, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.85rem' }}>
          <span>Reservas: <strong style={{ color: anfitrion.agendaAbierta ? '#16a34a' : '#dc2626' }}>{anfitrion.agendaAbierta ? 'ABIERTA' : 'CERRADA'}</strong></span>
          <button onClick={toggle} style={{ border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#fff', cursor: 'pointer', background: anfitrion.agendaAbierta ? '#dc2626' : '#16a34a' }}>
            {anfitrion.agendaAbierta ? 'Cerrar' : 'Abrir'}
          </button>
        </div>
      )}

      <form onSubmit={crear} style={{ ...card, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Publicar en la agenda de {anfitrion?.name ?? '…'}</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', flex: 1 }}><input type="radio" checked={disponible} onChange={() => setDisponible(true)} /> Hueco para reservar</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', flex: 1 }}><input type="radio" checked={!disponible} onChange={() => setDisponible(false)} /> Compromiso</label>
        </div>
        {!disponible && <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título del compromiso" required style={inp} />}
        <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required style={inp} />
        <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required style={inp} />
        <button type="submit" style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>+ Agregar</button>
      </form>

      <CalendarioMensual eventos={eventos} onDiaClick={(f) => setDia(f)} />

      {dia && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{dia.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          {delDia.length === 0 && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Sin entradas ese día.</div>}
          {delDia.map((e) => <ItemEntradaAgenda key={e.id} e={e} onCambio={cargar} />)}
        </div>
      )}
    </div>
  )
}
