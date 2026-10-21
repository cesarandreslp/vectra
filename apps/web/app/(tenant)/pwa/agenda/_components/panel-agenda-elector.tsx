'use client'

import { useEffect, useState } from 'react'
import {
  listarAnfitriones, getHuecosDisponibles, reservarHueco, getMisReservas,
  type AnfitrionOption, type HuecoDisponible, type EntradaAgenda,
} from '../actions'

export function PanelAgendaElector() {
  const [anfitriones, setAnfitriones] = useState<AnfitrionOption[]>([])
  const [anfitrionId, setAnfitrionId] = useState('')
  const [huecos, setHuecos] = useState<HuecoDisponible[]>([])
  const [reservas, setReservas] = useState<(EntradaAgenda & { anfitrionName: string })[]>([])
  const [reservando, setReservando] = useState<string | null>(null)

  async function cargarBase() {
    const [a, r] = await Promise.all([listarAnfitriones(), getMisReservas()])
    setAnfitriones(a)
    setReservas(r)
    if (a.length === 1) setAnfitrionId(a[0].id)
  }

  useEffect(() => { void cargarBase() }, [])

  useEffect(() => {
    if (!anfitrionId) { setHuecos([]); return }
    void getHuecosDisponibles(anfitrionId).then(setHuecos)
  }, [anfitrionId])

  async function onReservar(entradaId: string) {
    setReservando(entradaId)
    const res = await reservarHueco(entradaId)
    if (!res.success) alert(res.error)
    setReservando(null)
    await Promise.all([getHuecosDisponibles(anfitrionId).then(setHuecos), getMisReservas().then(setReservas)])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {reservas.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Mis reservas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {reservas.map((r) => (
              <div key={r.id} style={{ fontSize: '0.8rem' }}>
                {new Date(r.startsAt).toLocaleString('es-CO')} · con {r.anfitrionName}
                {r.estado === 'CANCELADA' && <strong style={{ color: '#dc2626' }}> · Cancelada</strong>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Reservar una cita</div>
        {anfitriones.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Todavía no hay agenda disponible.</div>
        ) : (
          <select
            value={anfitrionId} onChange={(e) => setAnfitrionId(e.target.value)}
            style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}
          >
            <option value="">Elige con quién...</option>
            {anfitriones.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.isCandidate ? ' (candidato)' : ''}</option>
            ))}
          </select>
        )}

        {anfitrionId && huecos.length === 0 && (
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No tiene horarios disponibles por ahora.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {huecos.map((h) => (
            <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '0.5rem' }}>
              <span>{new Date(h.startsAt).toLocaleString('es-CO')}</span>
              <button
                onClick={() => onReservar(h.id)} disabled={reservando === h.id}
                style={{ border: 'none', background: '#0f172a', color: '#fff', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                {reservando === h.id ? '...' : 'Reservar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
