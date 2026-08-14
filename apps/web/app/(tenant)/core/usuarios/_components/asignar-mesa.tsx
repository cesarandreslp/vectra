'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignWitness, type ComunaConBarrios } from '../../../dia-e/actions'
import { SelectorMesa } from './selector-mesa'

/**
 * Asignarle mesa a un testigo que ya existe.
 *
 * Hace falta además del alta porque un testigo puede quedar sin mesa: se creó
 * antes de que existiera este flujo, o su mesa se liberó. Sin esto quedaría
 * vivo y sin forma de ponerlo a vigilar nada.
 */
export function AsignarMesa({ userId, voterId, comunas }: {
  userId:  string
  voterId: string | null
  comunas: ComunaConBarrios[]
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [votingTableId, setVotingTableId] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!votingTableId) return
    setGuardando(true)
    const res = await assignWitness(userId, votingTableId, true)
    setGuardando(false)
    if (!res.success) { alert(res.error); return }
    setAbierto(false)
    // La cobertura se calcula en el servidor: sin refresh la lista de mesas
    // sin testigo seguiría mostrando la que se acaba de cubrir.
    router.refresh()
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        style={{
          border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e40af',
          borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.72rem',
          cursor: 'pointer', fontWeight: 600, marginTop: '0.35rem',
        }}
      >
        Asignar mesa
      </button>
    )
  }

  return (
    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <SelectorMesa comunas={comunas} voterId={voterId ?? undefined} onChange={setVotingTableId} />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={guardar}
          disabled={!votingTableId || guardando}
          style={{
            background: votingTableId ? '#0f172a' : '#cbd5e1', color: '#fff', border: 'none',
            borderRadius: '6px', padding: '0.3rem 0.8rem', fontSize: '0.75rem',
            cursor: votingTableId ? 'pointer' : 'not-allowed',
          }}
        >
          {guardando ? 'Asignando…' : 'Asignar'}
        </button>
        <button
          onClick={() => setAbierto(false)}
          style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
