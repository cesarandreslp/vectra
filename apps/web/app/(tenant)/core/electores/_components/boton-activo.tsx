'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setVoterActivo } from '../../actions'

/** Inactivar / reactivar a un elector desde su ficha. Su red no se toca. */
export function BotonActivoElector({ id, nombre, activo }: { id: string; nombre: string; activo: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function alternar() {
    if (activo && !confirm(`¿Inactivar a ${nombre}? No podrá entrar a la aplicación. Las personas que le reportan siguen activas.`)) return
    setError(null)
    startTransition(async () => {
      const res = await setVoterActivo(id, !activo)
      if (res.success) router.refresh()
      else setError(res.error)
    })
  }

  return (
    <>
      <button
        type="button" onClick={alternar} disabled={isPending}
        style={{
          border: `1px solid ${activo ? '#fecaca' : '#bbf7d0'}`, borderRadius: '6px', padding: '0.25rem 0.75rem',
          background: '#fff', fontSize: '0.8rem', fontWeight: 600, color: activo ? '#b91c1c' : '#166534',
          cursor: isPending ? 'wait' : 'pointer',
        }}
      >
        {isPending ? 'Guardando…' : activo ? 'Inactivar' : 'Reactivar'}
      </button>
      {error && (
        <div role="alert" style={{ flexBasis: '100%', fontSize: '0.8rem', color: '#991b1b', background: '#fee2e2', padding: '0.4rem 0.6rem', borderRadius: 6 }}>
          {error}
        </div>
      )}
    </>
  )
}
