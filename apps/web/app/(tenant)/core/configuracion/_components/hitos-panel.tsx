'use client'

import { useState, useTransition } from 'react'
import { crearHito, actualizarHito, eliminarHito, type HitoView, type HitoInput } from '../actions-plan'

const CANTIDADES: { key: 'contactos' | 'compromisos' | 'lideres' | 'multiplicadores'; label: string }[] = [
  { key: 'contactos',       label: 'Contactos' },
  { key: 'compromisos',     label: 'Compromisos' },
  { key: 'lideres',         label: 'Líderes' },
  { key: 'multiplicadores', label: 'Multiplicadores' },
]

const VACIO: HitoInput = { fecha: '', contactos: 0, compromisos: 0, lideres: 0, multiplicadores: 0, nota: '' }

/** Hitos con fecha del plan: lo que la red debe tener para cada fecha. */
export function HitosPanel({ hitos }: { hitos: HitoView[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {hitos.map((h) => <HitoFila key={`${h.id}-${h.fecha}`} hito={h} />)}
      <HitoFila />
    </div>
  )
}

/** Sin `hito` es la fila para crear uno nuevo. */
function HitoFila({ hito }: { hito?: HitoView }) {
  const [v, setV] = useState<HitoInput>(hito ?? VACIO)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function ejecutar(accion: () => Promise<{ success: true } | { success: false; error: string }>, limpiar = false) {
    setError(null)
    startTransition(async () => {
      const res = await accion()
      if (!res.success) setError(res.error)
      else if (limpiar) setV(VACIO)
    })
  }

  return (
    <div style={{ background: hito ? '#fff' : '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.85rem 1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.6rem' }}>
        <label style={label}>
          Fecha
          <input type="date" value={v.fecha} onChange={(e) => setV({ ...v, fecha: e.target.value })} style={input} />
        </label>
        {CANTIDADES.map(({ key, label: l }) => (
          <label key={key} style={label}>
            {l}
            <input
              type="number" min={0} value={v[key]}
              onChange={(e) => setV({ ...v, [key]: Number(e.target.value) })}
              style={input}
            />
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.6rem', flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Nota (opcional)" value={v.nota ?? ''}
          onChange={(e) => setV({ ...v, nota: e.target.value })}
          style={{ ...input, marginTop: 0, flex: '1 1 200px', width: 'auto' }}
        />
        {hito ? (
          <>
            <button type="button" disabled={pending} onClick={() => ejecutar(() => actualizarHito(hito.id, v))} style={boton}>Guardar</button>
            <button
              type="button" disabled={pending}
              onClick={() => { if (confirm('¿Eliminar este hito?')) ejecutar(() => eliminarHito(hito.id)) }}
              style={{ ...boton, background: '#fee2e2', color: '#b91c1c' }}
            >
              Eliminar
            </button>
          </>
        ) : (
          <button type="button" disabled={pending || !v.fecha} onClick={() => ejecutar(() => crearHito(v), true)} style={boton}>
            Agregar hito
          </button>
        )}
      </div>
      {error && <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: '#b91c1c' }}>{error}</p>}
    </div>
  )
}

const label: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#374151' }
const input: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.45rem 0.6rem',
  border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.85rem', boxSizing: 'border-box',
}
const boton: React.CSSProperties = {
  border: 'none', background: '#1e40af', color: '#fff', padding: '0.5rem 1rem',
  borderRadius: 6, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
}
