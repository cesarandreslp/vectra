'use client'

import { useMemo, useState, useTransition } from 'react'
import { guardarCargo, type CargosView, type CargoView, type PlazaView } from '../actions-cargos'
import type { EstadoCargo } from '../_lib/cargos'

const ESTADOS: Record<EstadoCargo, { label: string; color: string }> = {
  VACANTE:      { label: 'Vacante',         color: '#b45309' },
  CONVERSACION: { label: 'En conversación', color: '#1e40af' },
  ASIGNADO:     { label: 'Asignado',        color: '#15803d' },
}

interface Comun { data: CargosView; nombres: Map<string, string> }

/** Cargos que pide la plantilla del tipo de campaña, cada plaza con su estado. */
export function CargosRequeridos({ data }: { data: CargosView }) {
  const nombres = useMemo(
    () => new Map([...data.equipo, ...data.electores].map((o) => [o.id, o.nombre])),
    [data.equipo, data.electores],
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {data.cargos.map((c) => c.multiple
        ? <CargoMultiple key={c.clave} cargo={c} data={data} nombres={nombres} />
        : <PlazaFila key={c.clave} cargo={c} plaza={c.plazas[0]} titulo={c.nombre} descripcion={c.descripcion} data={data} nombres={nombres} />)}
    </div>
  )
}

function CargoMultiple({ cargo, data, nombres }: Comun & { cargo: CargoView }) {
  const asignados = cargo.plazas.filter((p) => p.estado === 'ASIGNADO').length
  return (
    <details>
      <summary style={{ cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem', color: '#0f172a' }}>
        {cargo.nombre} · <span style={{ fontWeight: 400, color: '#64748b' }}>{asignados} / {cargo.plazas.length} asignados</span>
      </summary>
      <p style={{ margin: '0.1rem 0 0.6rem', fontSize: '0.75rem', color: data.sinMeta ? '#b45309' : '#64748b' }}>
        {data.sinMeta ? 'Define la meta de votos en Configuración para saber cuántos hacen falta.' : cargo.descripcion}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.75rem' }}>
        {cargo.plazas.map((p) => (
          <PlazaFila key={p.indice} cargo={cargo} plaza={p} titulo={`${cargo.nombre} ${p.indice + 1}`} data={data} nombres={nombres} />
        ))}
      </div>
    </details>
  )
}

function PlazaFila({ cargo, plaza, titulo, descripcion, data, nombres }: Comun & {
  cargo: CargoView; plaza: PlazaView; titulo: string; descripcion?: string
}) {
  const [estado, setEstado]     = useState(plaza.estado)
  const [persona, setPersona]   = useState(plaza.persona ?? '')
  const [eligiendo, setEligiendo] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [pending, start]        = useTransition()

  function guardar(e: EstadoCargo, p: string) {
    const quien = e === 'VACANTE' ? '' : p // una vacante no tiene persona
    setEstado(e); setPersona(quien); setError(null)
    if (e === 'ASIGNADO' && !quien) { setEligiendo(true); return } // falta elegir a quién
    setEligiendo(false)
    start(async () => {
      const res = await guardarCargo(cargo.clave, plaza.indice, e, quien || null)
      if (!res.success) setError(res.error)
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#0f172a' }}>{titulo}</span>
        <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          {estado !== 'VACANTE' && (eligiendo ? (
            <select
              autoFocus value={persona} disabled={pending}
              onChange={(e) => guardar(estado, e.target.value)}
              onBlur={() => setEligiendo(false)}
              style={{ ...control, maxWidth: 240 }}
            >
              <option value="">— elegir persona —</option>
              <optgroup label="Equipo">{data.equipo.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</optgroup>
              <optgroup label="Electores">{data.electores.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</optgroup>
            </select>
          ) : (
            <button type="button" onClick={() => setEligiendo(true)} style={personaBtn(Boolean(persona))}>
              {persona ? (nombres.get(persona) ?? 'persona no encontrada') : 'elegir persona'}
            </button>
          ))}
          <select
            value={estado} disabled={pending}
            onChange={(e) => guardar(e.target.value as EstadoCargo, persona)}
            style={{ ...control, color: ESTADOS[estado].color, fontWeight: 600 }}
          >
            {(Object.keys(ESTADOS) as EstadoCargo[]).map((k) => <option key={k} value={k}>{ESTADOS[k].label}</option>)}
          </select>
        </span>
      </div>
      {descripcion && <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>{descripcion}</p>}
      {error && <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#b91c1c' }}>{error}</p>}
    </div>
  )
}

const control: React.CSSProperties = { fontSize: '0.78rem', padding: '0.2rem 0.35rem', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' }
const personaBtn = (hay: boolean): React.CSSProperties => ({
  background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.8rem',
  color: hay ? '#0f172a' : '#94a3b8', textDecoration: 'underline dotted', textUnderlineOffset: 3,
})
