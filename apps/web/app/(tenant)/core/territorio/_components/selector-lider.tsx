'use client'

/**
 * Asigna el líder de una comuna o de un barrio. Es el mismo control en los dos
 * niveles, así que vive aparte en vez de duplicarse en el panel.
 */

import { useState, useTransition } from 'react'

interface Props {
  liderActual: { id: string; name: string } | null
  electores:   { id: string; name: string }[]
  onAsignar:   (liderId: string | null) => Promise<{ success: boolean; error?: string }>
}

export function SelectorLider({ liderActual, electores, onAsignar }: Props) {
  // El nombre se muestra desde acá y no desde el prop: la lista de la que
  // cuelga este control no se vuelve a pedir al servidor tras asignar.
  const [lider, setLider]       = useState(liderActual)
  const [editando, setEditando] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, start]      = useTransition()

  const asignar = (liderId: string | null) => {
    start(async () => {
      const res = await onAsignar(liderId)
      if (!res.success) { setError(res.error ?? 'No se pudo asignar.'); return }
      setLider(electores.find((v) => v.id === liderId) ?? null)
      setEditando(false)
      setError(null)
    })
  }

  if (!editando) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setEditando(true) }}
        title="Con quién se coordina este territorio"
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: '0.72rem', color: lider ? '#0f172a' : '#94a3b8',
          textDecoration: 'underline dotted', textUnderlineOffset: 3,
        }}
      >
        {lider ? `👤 ${lider.name}` : 'sin líder'}
      </button>
    )
  }

  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
      <select
        defaultValue={lider?.id ?? ''}
        disabled={isPending}
        onChange={(e) => asignar(e.target.value || null)}
        style={{ fontSize: '0.75rem', padding: '0.2rem 0.35rem', border: '1px solid #cbd5e1', borderRadius: 4, maxWidth: 220 }}
      >
        <option value="">— sin líder —</option>
        {electores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <button
        onClick={() => { setEditando(false); setError(null) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#64748b' }}
      >
        cancelar
      </button>
      {error && <span style={{ fontSize: '0.7rem', color: '#991b1b' }}>{error}</span>}
    </span>
  )
}
