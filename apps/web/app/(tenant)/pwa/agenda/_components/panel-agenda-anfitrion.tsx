'use client'

import { useEffect, useState } from 'react'
import { getMiAgenda, crearEntradaAgenda, type EntradaAgenda } from '../actions'
import { CalendarioMensual } from '@/app/_components/calendario-mensual'
import { ItemEntradaAgenda, eventoDeEntrada, entradasDelDia } from '@/app/_components/entrada-agenda'

export function PanelAgendaAnfitrion() {
  const [entradas, setEntradas] = useState<EntradaAgenda[] | null>(null)
  const [disponible, setDisponible] = useState(true)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [titulo, setTitulo] = useState('')
  const [creando, setCreando] = useState(false)
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null)

  async function cargar() {
    setEntradas(await getMiAgenda())
  }

  useEffect(() => { void cargar() }, [])

  async function onCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!startsAt || !endsAt) return
    setCreando(true)
    const res = await crearEntradaAgenda({ startsAt, endsAt, disponible, titulo: titulo || undefined })
    if (!res.success) alert(res.error)
    setStartsAt(''); setEndsAt(''); setTitulo('')
    setCreando(false)
    await cargar()
  }

  if (entradas === null) return <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>Cargando...</div>

  const eventos = entradas.map(eventoDeEntrada)
  const entradasDelDiaSel = entradasDelDia(entradas, diaSeleccionado)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <form onSubmit={onCrear} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Publicar en mi agenda</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', flex: 1 }}>
            <input type="radio" checked={disponible} onChange={() => setDisponible(true)} />
            Hueco para reservar
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', flex: 1 }}>
            <input type="radio" checked={!disponible} onChange={() => setDisponible(false)} />
            Compromiso propio
          </label>
        </div>
        {!disponible && (
          <input
            value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título del compromiso" required={!disponible}
            style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
          />
        )}
        <input
          type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required
          style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
        />
        <input
          type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required
          style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
        />
        <button
          type="submit" disabled={creando}
          style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
        >
          {creando ? 'Guardando...' : '+ Agregar'}
        </button>
      </form>

      <CalendarioMensual eventos={eventos} onDiaClick={(fecha) => setDiaSeleccionado(fecha)} />

      {diaSeleccionado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
            {diaSeleccionado.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {entradasDelDiaSel.length === 0 && (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Sin entradas ese día.</div>
          )}
          {entradasDelDiaSel.map((e) => <ItemEntradaAgenda key={e.id} e={e} onCambio={() => void cargar()} />)}
        </div>
      )}
    </div>
  )
}
