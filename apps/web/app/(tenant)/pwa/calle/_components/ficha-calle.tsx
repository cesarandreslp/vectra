'use client'

import { useState } from 'react'
import type { ContactoNuevo } from '../actions'

const TEMPS: { v: NonNullable<ContactoNuevo['temperatura']>; label: string; color: string }[] = [
  { v: 'FRIO',     label: 'Frío',     color: '#60a5fa' },
  { v: 'TIBIO',    label: 'Tibio',    color: '#fbbf24' },
  { v: 'CALIENTE', label: 'Caliente', color: '#ef4444' },
]

/** El GPS ayuda a mandar el contacto al líder de la zona, pero nunca frena la captura. */
function ubicacion(): Promise<{ lat?: number; lng?: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({})
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({}),
      { timeout: 5000, maximumAge: 60_000, enableHighAccuracy: true },
    )
  })
}

/** Ficha de 10 segundos para quien sí da sus datos. */
export function FichaCalle({ onGuardar }: { onGuardar: (c: Omit<ContactoNuevo, 'id' | 'fecha'>) => Promise<void> }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [temperatura, setTemperatura] = useState<ContactoNuevo['temperatura']>()
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk] = useState<string | null>(null)

  async function guardar() {
    if (!nombre.trim()) return
    setGuardando(true)
    const gps = await ubicacion()
    await onGuardar({ nombre: nombre.trim(), telefono: telefono.trim() || undefined, temperatura, nota: nota.trim() || undefined, ...gps })
    setOk(`${nombre.trim()} anotado.`)
    setNombre(''); setTelefono(''); setTemperatura(undefined); setNota('')
    setGuardando(false)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Anotar a alguien</p>
      <input placeholder="Nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); setOk(null) }} style={input} autoComplete="off" />
      <input placeholder="Celular (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} style={input} inputMode="tel" type="tel" autoComplete="off" />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {TEMPS.map((t) => (
          <button
            key={t.v} type="button" onClick={() => setTemperatura(temperatura === t.v ? undefined : t.v)}
            style={{
              flex: 1, padding: '0.55rem 0', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              border: `2px solid ${t.color}`, background: temperatura === t.v ? t.color : '#fff', color: temperatura === t.v ? '#fff' : '#0f172a',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input placeholder="Nota (qué le preocupa, dónde lo vio…)" value={nota} onChange={(e) => setNota(e.target.value)} style={input} />
      <button
        type="button" onClick={guardar} disabled={guardando || !nombre.trim()}
        style={{ border: 'none', borderRadius: 8, padding: '0.75rem', background: nombre.trim() ? '#0f172a' : '#cbd5e1', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
      >
        {guardando ? 'Guardando…' : 'Guardar contacto'}
      </button>
      {ok && <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803d' }}>{ok} El líder de la zona le hará seguimiento.</p>}
    </div>
  )
}

const input: React.CSSProperties = {
  width: '100%', padding: '0.7rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: 8,
  fontSize: '1rem', boxSizing: 'border-box',
}
