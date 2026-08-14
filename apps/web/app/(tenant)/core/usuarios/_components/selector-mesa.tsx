'use client'

import { useEffect, useState } from 'react'
import { puestosParaTestigo, type ComunaConBarrios, type PuestoParaTestigo } from '../../../dia-e/actions'

/**
 * Comuna → puesto → mesa, con el puesto más cercano propuesto de primero.
 *
 * La cercanía se mide desde el barrio (o desde la comuna si no se eligió uno).
 * Es una propuesta y nada más: la lista completa de la comuna queda disponible
 * y se puede escoger cualquiera.
 */
export function SelectorMesa({ comunas, onChange }: {
  comunas: ComunaConBarrios[]
  onChange: (votingTableId: string) => void
}) {
  const [communeId, setCommuneId]           = useState('')
  const [neighborhoodId, setNeighborhoodId] = useState('')
  const [puestos, setPuestos]   = useState<PuestoParaTestigo[]>([])
  const [cargando, setCargando] = useState(false)
  const [stationId, setStationId] = useState('')

  const comuna = comunas.find(c => c.id === communeId)
  const puesto = puestos.find(p => p.id === stationId)

  useEffect(() => {
    if (!communeId) { setPuestos([]); setStationId(''); onChange(''); return }
    setCargando(true)
    puestosParaTestigo(communeId, neighborhoodId || undefined)
      .then((res) => {
        setPuestos(res)
        // El más cercano queda propuesto solo; se puede cambiar.
        const propuesto = res[0]?.id ?? ''
        setStationId(propuesto)
        onChange('')
      })
      .finally(() => setCargando(false))
    // onChange viene del padre y cambia en cada render: incluirlo relanzaría
    // la consulta en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communeId, neighborhoodId])

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4 }}>
        Mesa que va a vigilar. Se propone el puesto más cercano a su barrio — es
        una sugerencia, podés escoger cualquiera.
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
        <select value={stationId} onChange={(e) => { setStationId(e.target.value); onChange('') }} style={inputStyle}>
          {puestos.map((p, i) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.distanciaKm !== null ? ` · ${p.distanciaKm.toFixed(1)} km` : ' · sin ubicación'}
              {i === 0 && p.distanciaKm !== null ? ' — el más cercano' : ''}
            </option>
          ))}
        </select>
      )}

      {puesto && (
        <select onChange={(e) => onChange(e.target.value)} defaultValue="" style={inputStyle}>
          <option value="">Elige la mesa…</option>
          {puesto.mesas.map(m => (
            <option key={m.id} value={m.id} disabled={m.ocupadaPor !== null}>
              Mesa {m.number}{m.ocupadaPor ? ` — ya la vigila ${m.ocupadaPor}` : ''}
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
