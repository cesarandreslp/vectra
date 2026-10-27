'use client'

import { useState, useTransition } from 'react'
import { crearProspecto, type EmbudoView } from '../../actions-prospectos'
import { ETAPAS } from '../../_lib/etapas'
import { TarjetaProspecto } from './tarjeta-prospecto'

/** Alta de prospectos + una columna por etapa. */
export function Embudo({ data }: { data: EmbudoView }) {
  const [nombre, setNombre]     = useState('')
  const [telefono, setTelefono] = useState('')
  const [notas, setNotas]       = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [pendiente, start]      = useTransition()

  function onCrear(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const r = await crearProspecto({ nombre, telefono, notas })
      if (!r.success) return setError(r.error)
      setError(null); setNombre(''); setTelefono(''); setNotas('')
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <form onSubmit={onCrear} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required style={{ ...input, flex: '2 1 180px' }} />
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono (opcional)" inputMode="tel" style={{ ...input, flex: '1 1 140px' }} />
        <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Nota (opcional)" style={{ ...input, flex: '3 1 200px' }} />
        <button type="submit" disabled={pendiente} style={boton}>+ Agregar candidato</button>
        {error && <span style={{ color: '#b91c1c', fontSize: '0.8rem', width: '100%' }}>{error}</span>}
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', alignItems: 'start' }}>
        {ETAPAS.map((etapa) => {
          const lista = data.prospectos.filter((p) => p.etapa === etapa.key)
          return (
            <section key={etapa.key} style={{ background: '#f8fafc', borderRadius: 12, padding: '0.75rem' }}>
              <h2 style={{ fontSize: '0.8rem', fontWeight: 600, color: etapa.color, margin: '0 0 0.6rem' }}>
                {etapa.label} · {lista.length}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {lista.length === 0 && <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>Nadie aquí.</p>}
                {lista.map((p) => <TarjetaProspecto key={p.id} p={p} responsables={data.responsables} />)}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

export const input: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 8, padding: '0.45rem 0.6rem', fontSize: '0.85rem', minWidth: 0 }
export const boton: React.CSSProperties = { border: 'none', background: '#1e40af', color: '#fff', borderRadius: 8, padding: '0.5rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }
