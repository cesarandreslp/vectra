'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getElectoresDePuesto, type ElectorDePuesto, type StationGeo } from '../actions'

const COLOR_ESTADO: Record<string, string> = {
  SIN_CONTACTAR: '#94a3b8',
  CONTACTADO:    '#3b82f6',
  SIMPATIZANTE:  '#eab308',
  COMPROMETIDO:  '#22c55e',
  VOTO_SEGURO:   '#15803d',
}

interface PanelPuestoProps {
  puesto:   StationGeo
  onCerrar: () => void
}

/** Tabla de quienes votan en el puesto elegido en el mapa. */
export function PanelPuesto({ puesto, onCerrar }: PanelPuestoProps) {
  const [electores, setElectores] = useState<ElectorDePuesto[] | null>(null)

  useEffect(() => {
    let vigente = true
    setElectores(null)
    void getElectoresDePuesto(puesto.id).then((r) => { if (vigente) setElectores(r) })
    return () => { vigente = false }
  }, [puesto.id])

  return (
    <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{puesto.name}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {electores ? `${electores.length} elector(es)` : 'Cargando…'}
          </div>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b' }}>
          ×
        </button>
      </div>

      <div style={{ overflow: 'auto', minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
              <th style={celda}>Mesa</th>
              <th style={celda}>Nombre</th>
              <th style={celda}>Líder</th>
            </tr>
          </thead>
          <tbody>
            {electores?.map((e) => (
              <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ ...celda, fontWeight: 600 }}>{e.mesa}</td>
                <td style={celda}>
                  <span title={e.commitmentStatus.replace(/_/g, ' ')} style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6,
                    background: COLOR_ESTADO[e.commitmentStatus] ?? '#94a3b8',
                  }} />
                  <Link href={`/core/electores/${e.id}`} style={{ color: '#0f172a', textDecoration: 'none' }}>{e.name}</Link>
                </td>
                <td style={{ ...celda, color: '#64748b' }}>{e.leaderName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const celda: React.CSSProperties = { padding: '0.45rem 0.6rem', verticalAlign: 'top' }
