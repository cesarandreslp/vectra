'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCommune, updateCommune, listNeighborhoods, createNeighborhood, updateNeighborhood,
  asignarLiderComuna, asignarLiderBarrio, resolverBarriosPendientes,
  type CommuneSummary, type NeighborhoodSummary, type CommuneKind,
} from '../actions'
import { EditableTexto } from './editable-texto'
import { SelectorLider } from './selector-lider'

export function ComunasPanel({ municipalityId, comunasIniciales, electores }: {
  municipalityId: string
  comunasIniciales: CommuneSummary[]
  /** Candidatos a líder de comuna o de barrio: cualquier elector de la campaña. */
  electores: { id: string; name: string }[]
}) {
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [barrios, setBarrios] = useState<Record<string, NeighborhoodSummary[]>>({})
  const [nombreNueva, setNombreNueva] = useState('')
  const [tipoNueva, setTipoNueva] = useState<CommuneKind>('COMUNA')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function toggleExpandir(comunaId: string) {
    if (expandidoId === comunaId) { setExpandidoId(null); return }
    setExpandidoId(comunaId)
    if (!barrios[comunaId]) {
      listNeighborhoods(comunaId).then((bs) => setBarrios((prev) => ({ ...prev, [comunaId]: bs })))
    }
  }

  function agregarComuna() {
    setError(null)
    startTransition(async () => {
      const res = await createCommune({ name: nombreNueva, type: tipoNueva, municipalityId })
      if (res.success) { setNombreNueva(''); router.refresh() }
      else setError(res.error)
    })
  }

  function renombrarComuna(id: string, name: string) {
    startTransition(async () => { await updateCommune(id, { name }); router.refresh() })
  }

  function agregarBarrio(comunaId: string, nombre: string) {
    startTransition(async () => {
      const res = await createNeighborhood({ name: nombre, communeId: comunaId })
      if (res.success) {
        listNeighborhoods(comunaId).then((bs) => setBarrios((prev) => ({ ...prev, [comunaId]: bs })))
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  function renombrarBarrio(id: string, comunaId: string, name: string) {
    startTransition(async () => {
      await updateNeighborhood(id, { name })
      listNeighborhoods(comunaId).then((bs) => setBarrios((prev) => ({ ...prev, [comunaId]: bs })))
    })
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Comunas y corregimientos</h2>
        <BotonUbicar />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {comunasIniciales.map((c) => (
          <div key={c.id} style={{ border: '1px solid #f1f5f9', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer' }}
                 onClick={() => toggleExpandir(c.id)}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{expandidoId === c.id ? '▾' : '▸'}</span>
              {/* Mismo color que el polígono de esta zona en el mapa del dashboard. */}
              <span
                title={c.tieneLimites ? 'Color de esta zona en el mapa' : 'Sin límites cargados: no se dibuja en el mapa'}
                style={{
                  width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                  background: c.tieneLimites ? c.color : 'transparent',
                  border: c.tieneLimites ? 'none' : '1px dashed #cbd5e1',
                }}
              />
              <EditableTexto valor={c.name} onGuardar={(v) => renombrarComuna(c.id, v)} negrita />
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {c.type === 'COMUNA' ? 'Comuna' : 'Corregimiento'} · {c.neighborhoodCount} barrio(s)
                {!c.tieneLimites && ' · sin límites'}
              </span>
              <SelectorLider
                liderActual={c.lider} electores={electores}
                onAsignar={(liderId) => asignarLiderComuna(c.id, liderId)}
              />
            </div>

            {expandidoId === c.id && (
              <div style={{ padding: '0.5rem 0.75rem 0.75rem 2rem', borderTop: '1px solid #f8fafc' }}>
                {(barrios[c.id] ?? []).map((b) => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0', flexWrap: 'wrap' }}>
                    <EditableTexto valor={b.name} onGuardar={(v) => renombrarBarrio(b.id, c.id, v)} />
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{b.habitantes} elector(es)</span>
                    <SelectorLider
                      liderActual={b.lider} electores={electores}
                      onAsignar={(liderId) => asignarLiderBarrio(b.id, liderId)}
                    />
                  </div>
                ))}
                <FormNuevoBarrio onAgregar={(nombre) => agregarBarrio(c.id, nombre)} />
              </div>
            )}
          </div>
        ))}
        {comunasIniciales.length === 0 && (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sin comunas cargadas en este municipio todavía.</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <input
          type="text" value={nombreNueva} onChange={(e) => setNombreNueva(e.target.value)}
          placeholder="Nombre de la comuna o corregimiento" style={{ ...estiloInput, flex: 1 }}
        />
        <select value={tipoNueva} onChange={(e) => setTipoNueva(e.target.value as CommuneKind)} style={estiloInput}>
          <option value="COMUNA">Comuna</option>
          <option value="CORREGIMIENTO">Corregimiento</option>
        </select>
        <button onClick={agregarComuna} disabled={isPending || !nombreNueva.trim()} style={estiloBoton}>
          + Agregar
        </button>
      </div>
      {error && <p style={{ color: '#991b1b', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>}
    </div>
  )
}

/** Cruza las coordenadas de los electores contra los polígonos para ubicarlos en su barrio. */
function BotonUbicar() {
  const [resultado, setResultado] = useState<string | null>(null)
  const [isPending, start] = useTransition()
  const router = useRouter()

  const ubicar = () => start(async () => {
    const { resueltos, fueraDePoligono } = await resolverBarriosPendientes()
    setResultado(
      resueltos === 0 && fueraDePoligono === 0
        ? 'Todos los electores geocodificados ya tienen barrio.'
        : `${resueltos} ubicado(s)` + (fueraDePoligono ? ` · ${fueraDePoligono} fuera de todo polígono` : ''),
    )
    router.refresh()
  })

  return (
    <>
      <button
        onClick={ubicar} disabled={isPending}
        title="Asigna el barrio a los electores geocodificados que todavía no lo tienen"
        style={{ ...estiloBoton, padding: '0.3rem 0.7rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#0f172a' }}
      >
        {isPending ? 'Ubicando…' : '📍 Ubicar electores en su barrio'}
      </button>
      {resultado && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{resultado}</span>}
    </>
  )
}

function FormNuevoBarrio({ onAgregar }: { onAgregar: (nombre: string) => void }) {
  const [nombre, setNombre] = useState('')
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
      <input
        type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
        placeholder="Nuevo barrio" style={{ ...estiloInput, flex: 1, padding: '0.35rem 0.6rem' }}
      />
      <button
        onClick={() => { if (nombre.trim()) { onAgregar(nombre); setNombre('') } }}
        style={{ ...estiloBoton, padding: '0.35rem 0.75rem' }}
      >
        + Barrio
      </button>
    </div>
  )
}

const estiloInput: React.CSSProperties = {
  padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1',
  borderRadius: '6px', fontSize: '0.875rem', outline: 'none', background: '#fff',
}

const estiloBoton: React.CSSProperties = {
  background: '#0f172a', color: '#fff', border: 'none',
  padding: '0.5rem 1rem', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
}
