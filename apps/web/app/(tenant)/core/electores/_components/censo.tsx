'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { verificarCensoElector, verificarPadronCenso } from '../../actions-censo'

interface BotonCensoProps {
  /** Con voterId verifica a ese elector; sin él corre un lote sobre el padrón. */
  voterId?:  string
  pendiente?: boolean
}

export function BotonCenso({ voterId, pendiente }: BotonCensoProps) {
  const router = useRouter()
  const [enCurso, startTransition] = useTransition()
  const [mensaje, setMensaje] = useState<string | null>(null)

  function verificar() {
    setMensaje(null)
    startTransition(async () => {
      if (voterId) {
        const r = await verificarCensoElector(voterId)
        if (!r.success) setMensaje(r.error ?? 'No se pudo verificar.')
      } else {
        const r = await verificarPadronCenso()
        setMensaje(r.success
          ? `${r.encolados} enviados a verificar · ${r.revisados} consultas revisadas · quedan ${r.restantes} sin resultado`
          : r.error)
      }
      router.refresh()
    })
  }

  const texto = enCurso ? 'Consultando…'
    : !voterId ? 'Verificar padrón en el censo'
    : pendiente ? 'Revisar resultado'
    : 'Verificar en el censo'

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
      <button onClick={verificar} disabled={enCurso} style={{
        background: '#f1f5f9', color: '#475569', padding: '0.5rem 1rem', borderRadius: '6px',
        fontSize: '0.875rem', border: '1px solid #e2e8f0', cursor: enCurso ? 'wait' : 'pointer',
      }}>
        {texto}
      </button>
      {mensaje && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{mensaje}</span>}
    </div>
  )
}

interface FichaCensoProps {
  voterId: string
  estado:  string | null
  lugar:   Record<string, unknown> | null
  puedeVerificar: boolean
}

const TEXTO_ESTADO: Record<string, string> = {
  PENDIENTE:     'Consultando a la Registraduría…',
  NO_ENCONTRADO: 'No aparece en el censo electoral',
  ERROR:         'La consulta falló — se reintenta en el próximo lote',
}

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)

/** Dónde vota según la Registraduría (campos de PuestoVotacion en la API). */
export function FichaCenso({ voterId, estado, lugar, puedeVerificar }: FichaCensoProps) {
  const puesto  = [texto(lugar?.puesto), texto(lugar?.mesa) && `Mesa ${lugar?.mesa}`].filter(Boolean).join(' · ')
  const ciudad  = [texto(lugar?.direccion), texto(lugar?.municipio), texto(lugar?.departamento)].filter(Boolean).join(', ')
  // Solo https: el enlace viene de un tercero y un "javascript:" sería XSS.
  const mapa    = texto(lugar?.mapa_url)?.startsWith('https://') ? String(lugar?.mapa_url) : null
  const mensaje = texto(lugar?.mensaje)

  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Censo electoral</div>
      <div style={{ fontSize: '0.9rem', color: estado === 'ENCONTRADO' ? '#166534' : estado ? '#92400e' : '#94a3b8' }}>
        {estado === 'ENCONTRADO' ? puesto || 'Inscrito' : estado ? TEXTO_ESTADO[estado] ?? estado : 'Sin verificar'}
      </div>
      {estado === 'ENCONTRADO' && ciudad && (
        <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.15rem' }}>
          {ciudad}
          {mapa && <> · <a href={mapa} target="_blank" rel="noopener noreferrer" style={{ color: '#1e40af' }}>Cómo llegar</a></>}
        </div>
      )}
      {estado === 'NO_ENCONTRADO' && mensaje && (
        <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '0.15rem' }}>{mensaje}</div>
      )}
      {puedeVerificar && (
        <div style={{ marginTop: '0.4rem' }}>
          <BotonCenso voterId={voterId} pendiente={estado === 'PENDIENTE'} />
        </div>
      )}
    </div>
  )
}
