'use client'

import { useEffect, useState } from 'react'
import { puestosParaTestigo, type ComunaConBarrios, type PropuestaMesa, type MotivoPropuesta } from '../../../dia-e/actions'

const EXPLICACION: Record<MotivoPropuesta, string> = {
  VOTA_AHI:            'Vota en esta mesa y está libre — es la mejor asignación posible.',
  CERCA_DE_DONDE_VOTA: 'Su mesa ya la vigila otro testigo, así que se proponen los puestos más cercanos a donde él vota.',
  CERCA_DE_DONDE_VIVE: 'No está inscrito en ninguna mesa: se proponen los puestos más cercanos a donde vive.',
  SIN_REFERENCIA:      'Sin barrio ni mesa de votación, el orden es desde el centro de la comuna. Elige un barrio para afinarlo.',
}

/**
 * Comuna → puesto → mesa, con la propuesta ya resuelta por el servidor.
 *
 * El orden no es solo distancia: depende de si el testigo ya vota en alguna
 * mesa (ver `puestosParaTestigo`). Acá solo se muestra el porqué y se deja
 * cambiar todo — la propuesta nunca obliga.
 */
export function SelectorMesa({ comunas, voterId, onChange }: {
  comunas: ComunaConBarrios[]
  /** Elector ya existente, si se escogió del padrón. Afina toda la propuesta. */
  voterId?: string
  onChange: (votingTableId: string) => void
}) {
  const [communeId, setCommuneId]           = useState('')
  const [neighborhoodId, setNeighborhoodId] = useState('')
  const [propuesta, setPropuesta] = useState<PropuestaMesa | null>(null)
  const [cargando, setCargando]   = useState(false)
  const [stationId, setStationId] = useState('')
  const [mesaId, setMesaId]       = useState('')

  const comuna = comunas.find(c => c.id === communeId)
  const puestos = propuesta?.puestos ?? []
  const puesto  = puestos.find(p => p.id === stationId)

  function elegirMesa(id: string) { setMesaId(id); onChange(id) }

  useEffect(() => {
    if (!communeId) { setPropuesta(null); setStationId(''); elegirMesa(''); return }
    setCargando(true)
    puestosParaTestigo(communeId, neighborhoodId || undefined, voterId)
      .then((res) => {
        setPropuesta(res)
        // El puesto de arriba queda propuesto; la mesa solo si el servidor
        // señaló una concreta (su propia mesa, libre).
        const propuestoStation = res.puestos.find(p => p.mesas.some(m => m.id === res.mesaPropuesta))
        setStationId(propuestoStation?.id ?? res.puestos[0]?.id ?? '')
        elegirMesa(res.mesaPropuesta ?? '')
      })
      .finally(() => setCargando(false))
    // onChange llega nuevo en cada render del padre: incluirlo relanzaría la
    // consulta en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communeId, neighborhoodId, voterId])

  // Si el testigo ya vota en algún lado, se abre en esa comuna sin preguntar.
  useEffect(() => {
    if (!voterId || communeId) return
    puestosParaTestigo(comunas[0]?.id ?? '', undefined, voterId)
      .then((res) => { if (res.comunaSugerida) setCommuneId(res.comunaSugerida) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voterId])

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4 }}>
        Mesa que va a vigilar. {propuesta ? EXPLICACION[propuesta.motivo] : 'La propuesta se calcula al elegir la comuna.'}
      </p>

      <select value={communeId} onChange={(e) => { setCommuneId(e.target.value); setNeighborhoodId('') }} style={inputStyle}>
        <option value="">Elige la comuna o corregimiento…</option>
        {comunas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {comuna && comuna.barrios.length > 0 && (
        <select value={neighborhoodId} onChange={(e) => setNeighborhoodId(e.target.value)} style={inputStyle}>
          <option value="">Barrio (opcional — afina la propuesta)</option>
          {comuna.barrios.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}

      {cargando && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Buscando puestos…</span>}

      {!cargando && communeId && puestos.length === 0 && (
        <span style={{ fontSize: '0.75rem', color: '#b45309' }}>
          No hay puestos en esta comuna. Puede ser que falten geocodificar.
        </span>
      )}

      {puestos.length > 0 && (
        <select value={stationId} onChange={(e) => { setStationId(e.target.value); elegirMesa('') }} style={inputStyle}>
          {puestos.map((p, i) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.esDondeVota ? ' · aquí vota'
                : p.distanciaKm !== null ? ` · ${p.distanciaKm.toFixed(1)} km`
                : ' · sin ubicación'}
              {i === 0 && !p.esDondeVota && p.distanciaKm !== null ? ' — el más cercano' : ''}
            </option>
          ))}
        </select>
      )}

      {puesto && (
        <select value={mesaId} onChange={(e) => elegirMesa(e.target.value)} style={inputStyle}>
          <option value="">Elige la mesa…</option>
          {puesto.mesas.map(m => (
            <option key={m.id} value={m.id} disabled={m.ocupadaPor !== null}>
              Mesa {m.number}
              {m.esSuMesa ? ' — es su mesa de votación' : ''}
              {m.ocupadaPor ? ` — ya la vigila ${m.ocupadaPor}` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem',
}
