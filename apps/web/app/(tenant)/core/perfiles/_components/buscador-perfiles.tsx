'use client'

import { useState } from 'react'
import { buscarPerfiles, type PerfilEncontrado } from '../actions'
import { DIAS, FRANJAS, slot, ETIQUETA_DIA, ETIQUETA_FRANJA, VEHICULOS, type Vehiculo } from '@/lib/perfil'

const input = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 0.65rem', fontSize: '0.85rem' }
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.9rem' }

const legible = (token: string) => {
  const [d, f] = token.split('_')
  return `${ETIQUETA_DIA[d as keyof typeof ETIQUETA_DIA] ?? d} ${(ETIQUETA_FRANJA[f as keyof typeof ETIQUETA_FRANJA] ?? f).toLowerCase()}`
}

export function BuscadorPerfiles({ iniciales }: { iniciales: PerfilEncontrado[] }) {
  const [resultados, setResultados] = useState(iniciales)
  const [busqueda, setBusqueda] = useState('')
  const [vehiculo, setVehiculo] = useState<'' | Vehiculo>('')
  const [zona, setZona] = useState('')
  const [franjas, setFranjas] = useState<string[]>([])
  const [buscando, setBuscando] = useState(false)

  async function buscar(e: React.FormEvent) {
    e.preventDefault()
    setBuscando(true)
    setResultados(await buscarPerfiles({
      busqueda: busqueda || undefined,
      vehiculo: vehiculo || undefined,
      zona: zona || undefined,
      disponibilidad: franjas.length ? franjas : undefined,
    }))
    setBuscando(false)
  }

  const alternar = (t: string) => setFranjas((f) => f.includes(t) ? f.filter((x) => x !== t) : [...f, t])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <form onSubmit={buscar} style={{ ...card, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'flex-end' }}>
          <label style={lbl}>Qué necesitás
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="conducir, cocinar, carpa…" style={{ ...input, minWidth: '200px' }} />
          </label>
          <label style={lbl}>Vehículo
            <select value={vehiculo} onChange={(e) => setVehiculo(e.target.value as '' | Vehiculo)} style={input}>
              <option value="">cualquiera</option>
              {VEHICULOS.map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}
            </select>
          </label>
          <label style={lbl}>Zona
            <input value={zona} onChange={(e) => setZona(e.target.value)} placeholder="comuna o barrio" style={input} />
          </label>
          <button type="submit" disabled={buscando} style={{ background: buscando ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            {buscando ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.3rem' }}>Que pueda en (se piden todas las marcadas)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {FRANJAS.flatMap((f) => DIAS.map((d) => {
              const t = slot(d, f)
              const activo = franjas.includes(t)
              return (
                <button key={t} type="button" onClick={() => alternar(t)} aria-pressed={activo}
                  style={{ border: `1px solid ${activo ? '#16a34a' : '#cbd5e1'}`, background: activo ? '#16a34a' : '#fff', color: activo ? '#fff' : '#475569', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer' }}>
                  {ETIQUETA_DIA[d]} {ETIQUETA_FRANJA[f].toLowerCase()}
                </button>
              )
            }))}
          </div>
        </div>
      </form>

      <div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>{resultados.length} persona(s)</div>
        {resultados.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Nadie con ese perfil todavía. Los datos los carga cada persona desde su PWA, en &quot;Mi perfil&quot;.</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
          {resultados.map((p) => (
            <div key={p.voterId} style={card}>
              <strong style={{ fontSize: '0.95rem' }}>{p.name}</strong>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {p.oficio ?? 'sin oficio cargado'}{p.zonaAccion ? ` · ${p.zonaAccion}` : ''}
              </div>
              {p.habilidades.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.4rem' }}>
                  {p.habilidades.map((h) => <span key={h} style={chip}>{h}</span>)}
                </div>
              )}
              {p.herramientas.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.35rem' }}>Puede poner: {p.herramientas.join(', ')}</div>
              )}
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.35rem' }}>
                {p.vehiculo !== 'NINGUNO' ? `${p.vehiculo.toLowerCase()} · ` : ''}{p.actividades} actividad(es) hechas
              </div>
              {p.disponibilidad.length > 0 && (
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                  Puede: {p.disponibilidad.map(legible).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const lbl = { display: 'flex', flexDirection: 'column' as const, gap: '0.2rem', fontSize: '0.75rem', color: '#64748b' }
const chip = { background: '#f1f5f9', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.72rem' }
