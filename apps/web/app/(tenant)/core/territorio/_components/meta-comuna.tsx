'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateCommune } from '../actions'

/** Meta de votos de una comuna, editable en el sitio: se guarda al salir del campo. */
export function MetaComuna({ id, meta }: { id: string; meta: number | null }) {
  const [valor, setValor] = useState(meta?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function guardar() {
    const nueva = valor.trim() === '' ? null : Number(valor)
    if (nueva === meta) return
    setError(null)
    startTransition(async () => {
      const res = await updateCommune(id, { metaVotos: nueva })
      if (res.success) router.refresh()
      else setError(res.error)
    })
  }

  return (
    <label onClick={(e) => e.stopPropagation()} title={error ?? 'Votos que la campaña se propone sacar aquí'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: error ? '#991b1b' : '#64748b' }}>
      Meta
      <input
        type="number" min={0} step={1} inputMode="numeric" value={valor} disabled={isPending}
        onChange={(e) => setValor(e.target.value)} onBlur={guardar}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        placeholder="—"
        style={{ width: 64, padding: '0.15rem 0.35rem', border: `1px solid ${error ? '#fca5a5' : '#cbd5e1'}`, borderRadius: 4, fontSize: '0.75rem' }}
      />
      votos
    </label>
  )
}
