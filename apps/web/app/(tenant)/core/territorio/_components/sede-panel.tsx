'use client'

/**
 * La sede de campaña: una sola por campaña, y es el techo de la cadena
 * territorial (sede → líder de comuna → líder de barrio). Existe desde que
 * existe la campaña, aunque todavía no la hayan nombrado.
 */

import { useState, useTransition } from 'react'
import { guardarSede, type Sede } from '../actions'
import { SelectorLider } from './selector-lider'
import { EditableTexto } from './editable-texto'

export function SedePanel({ sede, electores }: {
  sede: Sede
  electores: { id: string; name: string }[]
}) {
  const [s, setS] = useState(sede)
  const [error, setError] = useState<string | null>(null)
  const [, start] = useTransition()

  const guardar = (campo: 'nombre' | 'direccion', valor: string) => {
    setS((prev) => ({ ...prev, [campo]: valor }))
    start(async () => {
      const r = await guardarSede({ [campo]: valor })
      if (!r.success) setError(r.error)
    })
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>Sede de campaña</h2>
      <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.9rem' }}>
        Desde acá se coordina con los líderes de comuna y de barrio.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        {/* El texto de relleno va como placeholder y NO como valor: si no, al
            editar arranca con "sin dirección" adentro y queda pegado al frente. */}
        <Campo etiqueta="Nombre">
          <EditableTexto
            valor={s.nombre ?? ''} placeholder="Sede principal"
            onGuardar={(v) => guardar('nombre', v)}
            negrita
          />
        </Campo>

        <Campo etiqueta="Dirección">
          <EditableTexto
            valor={s.direccion ?? ''} placeholder="sin dirección"
            onGuardar={(v) => guardar('direccion', v)}
            permitirVacio
          />
        </Campo>

        <Campo etiqueta="Responsable">
          {/* Mismo control que en comuna y barrio: un cargo territorial más. */}
          <SelectorLider
            liderActual={s.lider}
            electores={electores}
            onAsignar={(liderId) => guardarSede({ liderId })}
          />
        </Campo>
      </div>

      {error && <p style={{ color: '#991b1b', fontSize: '0.8rem', marginTop: '0.6rem' }}>{error}</p>}
    </div>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.15rem' }}>{etiqueta}</div>
      {children}
    </div>
  )
}
