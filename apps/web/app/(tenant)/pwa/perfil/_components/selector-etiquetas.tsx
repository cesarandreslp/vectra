'use client'

/**
 * Campo de varias etiquetas (habilidades, herramientas, certificaciones): se
 * elige de una lista, y solo se escribe cuando la opción no está. Lo escrito
 * queda guardado y aparece como opción para el que llene el perfil después.
 *
 * Es un <input list> + <datalist> nativo: el navegador ya sabe hacer
 * "desplegable que además deja escribir", incluido el teclado del celular.
 */

import { useId, useState } from 'react'
import { normalizar } from '@/lib/perfil'

const input = {
  border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 0.6rem',
  fontSize: '0.85rem', flex: 1, minWidth: 0, boxSizing: 'border-box' as const,
}

export function SelectorEtiquetas({ valor, opciones, onChange, placeholder }: {
  valor: string[]
  opciones: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [texto, setTexto] = useState('')
  const listId = useId()

  const agregar = (t: string) => {
    const limpio = normalizar(t)
    if (!limpio || valor.includes(limpio)) { setTexto(''); return }
    onChange([...valor, limpio])
    setTexto('')
  }

  const disponibles = opciones.filter((o) => !valor.includes(o))

  return (
    <div>
      {valor.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.35rem' }}>
          {valor.map((t) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#e2e8f0', borderRadius: 999, padding: '0.15rem 0.5rem', fontSize: '0.78rem' }}>
              {t}
              <button
                type="button" onClick={() => onChange(valor.filter((x) => x !== t))} aria-label={`Quitar ${t}`}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.9rem', lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <input
          list={listId}
          value={texto}
          onChange={(e) => {
            // Elegir del desplegable no dispara Enter, así que hay que detectarlo:
            // el navegador lo marca como "insertReplacementText" (Firefox no manda
            // inputType). Escribir a mano sí trae inputType, y no se auto-agrega —
            // si no, "sonido profesional" se cortaría en "sonido" al ir tecleando.
            const tipo = (e.nativeEvent as InputEvent).inputType
            if (tipo === undefined || tipo === 'insertReplacementText') agregar(e.target.value)
            else setTexto(e.target.value)
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(texto) } }}
          placeholder={placeholder ?? 'Elegí de la lista o escribí el tuyo'}
          style={input}
        />
        <datalist id={listId}>
          {disponibles.map((o) => <option key={o} value={o} />)}
        </datalist>
        <button
          type="button" onClick={() => agregar(texto)} disabled={!texto.trim()}
          style={{ border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '6px', padding: '0 0.75rem', fontSize: '0.85rem', cursor: texto.trim() ? 'pointer' : 'not-allowed', color: '#475569' }}
        >
          +
        </button>
      </div>
    </div>
  )
}
