'use client'

/**
 * Una entrada de agenda en el detalle del día: horario, estado y acciones
 * (editar, marcar realizada / con retraso / incumplida / cancelada, borrar).
 * La usan las tres vistas que manejan agenda: anfitrión, gestor y admin.
 */

import { useState } from 'react'
import { editarEntrada, marcarEstadoEntrada, eliminarEntrada } from '@/app/(tenant)/pwa/agenda/actions'
import type { EventoCalendario } from './calendario-mensual'
import type { EstadoAgenda } from '@/lib/agenda'

export interface EntradaAgendaItem {
  id:             string
  startsAt:       string
  endsAt:         string
  disponible:     boolean
  titulo:         string | null
  reservanteName: string | null
  motivo:         string | null
  estado:         EstadoAgenda | null
  retrasoMin:     number | null
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
// ISO → valor de <input type="datetime-local"> en la hora del navegador.
const aInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
const clave = (iso: string) => aInput(iso).slice(0, 10)

function estadoVisible(e: EntradaAgendaItem): { txt: string; color: string } | null {
  if (e.estado === 'REALIZADA') return e.retrasoMin ? { txt: `Realizada · ${e.retrasoMin} min tarde`, color: '#d97706' } : { txt: 'Realizada', color: '#15803d' }
  if (e.estado === 'INCUMPLIDA') return { txt: 'Incumplida', color: '#dc2626' }
  if (e.estado === 'CANCELADA') return { txt: 'Cancelada', color: '#94a3b8' }
  if (new Date(e.endsAt) < new Date() && (!e.disponible || e.reservanteName)) return { txt: 'Sin marcar', color: '#7c3aed' }
  return null
}

/** Chip del calendario mensual: color por estado si ya se marcó, si no por tipo. */
export function eventoDeEntrada(e: EntradaAgendaItem): EventoCalendario {
  const nombre = !e.disponible ? e.titulo : e.reservanteName ? 'Reservado' : 'Libre'
  const est = estadoVisible(e)
  const color = e.estado ? est!.color : !e.disponible ? '#64748b' : e.reservanteName ? '#2563eb' : '#16a34a'
  return { id: e.id, fecha: clave(e.startsAt), label: `${hora(e.startsAt)} ${nombre}${e.estado === 'CANCELADA' ? ' (cancelada)' : ''}`, color }
}

export const entradasDelDia = <T extends EntradaAgendaItem>(entradas: T[], dia: Date | null) =>
  dia ? entradas.filter((e) => clave(e.startsAt) === clave(dia.toISOString())) : []

const btn = (color: string) => ({ border: `1px solid ${color}`, background: '#fff', color, borderRadius: '6px', padding: '0.2rem 0.5rem', fontSize: '0.72rem', cursor: 'pointer' })
const inp = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.35rem 0.5rem', fontSize: '0.8rem' }

export function ItemEntradaAgenda({ e, onCambio }: { e: EntradaAgendaItem; onCambio: () => void }) {
  const [editando, setEditando] = useState(false)
  const [startsAt, setStartsAt] = useState(aInput(e.startsAt))
  const [endsAt, setEndsAt] = useState(aInput(e.endsAt))
  const [titulo, setTitulo] = useState(e.titulo ?? '')

  async function correr(p: Promise<{ success: boolean; error?: string }>) {
    const r = await p
    if (!r.success) { alert(r.error); return }
    setEditando(false); onCambio()
  }
  function conRetraso() {
    const min = prompt('¿Cuántos minutos tarde arrancó?')
    if (min === null) return
    const n = Number(min)
    if (!Number.isInteger(n) || n < 0) { alert('Escribe un número de minutos.'); return }
    void correr(marcarEstadoEntrada(e.id, 'REALIZADA', n))
  }

  const est = estadoVisible(e)
  const pasada = new Date(e.startsAt) < new Date()

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', textDecoration: e.estado === 'CANCELADA' ? 'line-through' : 'none' }}>
            {e.disponible ? (e.reservanteName ? `Reservado — ${e.reservanteName}` : 'Hueco disponible') : e.titulo}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {hora(e.startsAt)} – {hora(e.endsAt)}{e.motivo ? ` · ${e.motivo}` : ''}
          </div>
        </div>
        {est && <span style={{ alignSelf: 'flex-start', fontSize: '0.7rem', fontWeight: 600, color: est.color, border: `1px solid ${est.color}`, borderRadius: '999px', padding: '0.1rem 0.5rem' }}>{est.txt}</span>}
      </div>

      {editando ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          {!e.disponible && <input value={titulo} onChange={(x) => setTitulo(x.target.value)} placeholder="Título" style={{ ...inp, flex: '1 1 160px' }} />}
          <input type="datetime-local" value={startsAt} onChange={(x) => setStartsAt(x.target.value)} style={inp} />
          <input type="datetime-local" value={endsAt} onChange={(x) => setEndsAt(x.target.value)} style={inp} />
          <button onClick={() => void correr(editarEntrada(e.id, { startsAt, endsAt, titulo }))} style={btn('#0f172a')}>Guardar</button>
          <button onClick={() => setEditando(false)} style={btn('#64748b')}>Cancelar</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {e.estado ? (
            <button onClick={() => void correr(marcarEstadoEntrada(e.id, null))} style={btn('#64748b')}>Volver a pendiente</button>
          ) : (
            <>
              <button onClick={() => setEditando(true)} style={btn('#0f172a')}>Editar</button>
              {pasada && <button onClick={() => void correr(marcarEstadoEntrada(e.id, 'REALIZADA', 0))} style={btn('#15803d')}>Realizada</button>}
              {pasada && <button onClick={conRetraso} style={btn('#d97706')}>Con retraso</button>}
              {pasada && <button onClick={() => void correr(marcarEstadoEntrada(e.id, 'INCUMPLIDA'))} style={btn('#dc2626')}>Incumplida</button>}
              <button onClick={() => void correr(marcarEstadoEntrada(e.id, 'CANCELADA'))} style={btn('#94a3b8')}>Cancelar reunión</button>
            </>
          )}
          {(!e.reservanteName || e.estado === 'CANCELADA') && (
            <button onClick={() => { if (confirm('¿Borrar esta entrada de la agenda?')) void correr(eliminarEntrada(e.id)) }} style={btn('#ef4444')}>Borrar</button>
          )}
        </div>
      )}
    </div>
  )
}
