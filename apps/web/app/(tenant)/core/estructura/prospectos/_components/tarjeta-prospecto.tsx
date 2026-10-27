'use client'

import { useState, useTransition } from 'react'
import {
  moverProspecto, reasignarProspecto, borrarProspecto, verTelefonoProspecto,
  type Etapa, type ProspectoView,
} from '../../actions-prospectos'
import { ETAPAS } from '../../_lib/etapas'
import { input, boton } from './embudo'

interface Props {
  p:            ProspectoView
  responsables: { id: string; nombre: string }[]
}

/** Un prospecto: quién lo lleva, desde cuándo está en su etapa y a dónde moverlo. */
export function TarjetaProspecto({ p, responsables }: Props) {
  const [pidiendoCedula, setPidiendoCedula] = useState(false)
  const [cedula, setCedula]     = useState('')
  const [telefono, setTelefono] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [pendiente, start]      = useTransition()

  function correr(accion: () => Promise<{ success: boolean; error?: string }>) {
    start(async () => {
      const r = await accion()
      setError(r.success ? null : (r.error ?? 'No se pudo.'))
      if (r.success) setPidiendoCedula(false)
    })
  }

  function mover(etapa: Etapa) {
    // Para aceptar hace falta la cédula: con ella se encuentra o crea su elector.
    if (etapa === 'ACEPTO' && !p.lider) return setPidiendoCedula(true)
    correr(() => moverProspecto(p.id, etapa))
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.6rem 0.7rem', opacity: pendiente ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{p.nombre}</strong>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
          {p.fechaEtapa.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
        </span>
      </div>
      {p.notas && <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>{p.notas}</p>}
      {p.lider && (
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: p.lider.conRed ? '#15803d' : '#b45309' }}>
          Elector: {p.lider.nombre} · {p.lider.conRed ? 'ya tiene red' : 'aún sin red'}
        </p>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.45rem', fontSize: '0.75rem', color: '#64748b' }}>
        Lo lleva
        <select
          value={p.responsableId ?? ''}
          onChange={(e) => correr(() => reasignarProspecto(p.id, e.target.value || null))}
          style={{ ...input, padding: '0.2rem 0.3rem', fontSize: '0.75rem', flex: 1 }}
        >
          <option value="">— nadie —</option>
          {/* Si quien lo lleva ya no está en la lista (perdió su red), se conserva igual. */}
          {p.responsableId && !responsables.some((r) => r.id === p.responsableId) && (
            <option value={p.responsableId}>{p.responsable}</option>
          )}
          {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
      </label>

      {pidiendoCedula && (
        <form onSubmit={(e) => { e.preventDefault(); correr(() => moverProspecto(p.id, 'ACEPTO', cedula)) }} style={{ display: 'flex', gap: '0.35rem', marginTop: '0.45rem' }}>
          <input value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="Cédula" inputMode="numeric" autoFocus style={{ ...input, flex: 1, fontSize: '0.78rem' }} />
          <button type="submit" style={{ ...boton, padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#15803d' }}>Aceptó</button>
        </form>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
        {ETAPAS.filter((e) => e.key !== p.etapa).map((e) => (
          <button key={e.key} onClick={() => mover(e.key)} disabled={pendiente} style={{ ...chip, color: e.color, borderColor: e.color }}>
            → {e.label}
          </button>
        ))}
        {p.tieneTelefono && (
          <button onClick={() => start(async () => setTelefono(await verTelefonoProspecto(p.id)))} style={chip}>
            {telefono ?? 'Ver teléfono'}
          </button>
        )}
        <button
          onClick={() => confirm(`¿Quitar a ${p.nombre} de la lista?`) && correr(() => borrarProspecto(p.id))}
          style={{ ...chip, color: '#94a3b8' }}
        >
          Quitar
        </button>
      </div>
      {error && <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#b91c1c' }}>{error}</p>}
    </div>
  )
}

const chip: React.CSSProperties = { border: '1px solid #e2e8f0', background: '#fff', borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.72rem', color: '#475569', cursor: 'pointer' }
