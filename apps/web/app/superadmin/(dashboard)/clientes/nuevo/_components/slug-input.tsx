'use client'

/**
 * Componente cliente para el campo slug del formulario de nuevo tenant.
 * Valida el slug en tiempo real en el browser usando regex.
 * Es el único componente 'use client' en el flujo de superadmin.
 */

import { useState } from 'react'

// Misma regex que usa createTenant() en el servidor
const REGEX_SLUG = /^[a-z0-9-]{3,}$/

// Dominio base sobre el que se monta el subdominio de cada campaña. Sale de
// TENANT_BASE_DOMAIN (ver env en next.config.ts); aquí solo se muestra.
const DOMINIO_BASE = process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN

interface SlugInputProps {
  value:    string
  onChange: (valor: string) => void
}

export function SlugInput({ value, onChange }: SlugInputProps) {
  const [tocado, setTocado] = useState(false)

  const valido  = REGEX_SLUG.test(value)
  const error   = tocado && value.length > 0 && !valido
  const vacio   = tocado && value.length === 0

  const borde = error || vacio
    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
    : valido && tocado
      ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100'
      : 'border-slate-300 focus:border-granate focus:ring-granate/20'

  return (
    <div>
      <label htmlFor="slug" className="block text-sm font-medium text-slate-700 mb-1.5">
        Slug de la campaña *
      </label>
      <div className="flex items-center gap-2">
        <input
          id="slug"
          name="slug"
          type="text"
          value={value}
          required
          autoComplete="off"
          placeholder="campana-gomez-2026"
          onChange={e => onChange(e.target.value.toLowerCase())}
          onBlur={() => setTocado(true)}
          className={`w-full rounded-md border px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-2 ${borde}`}
        />
        {/* Indicador visual de validación */}
        {tocado && value.length > 0 && (
          <span className={valido ? 'text-emerald-600' : 'text-red-500'} aria-hidden>
            {valido ? '✓' : '✗'}
          </span>
        )}
      </div>

      {/* Mensaje de error */}
      {(error || vacio) && (
        <p className="text-red-600 text-xs mt-1.5">
          {vacio
            ? 'El slug es obligatorio'
            : 'Solo minúsculas, números y guiones. Mínimo 3 caracteres.'}
        </p>
      )}

      {/* Hint cuando está vacío y no tocado */}
      {!tocado && (
        <p className="text-slate-400 text-xs mt-1.5">
          Será la URL de la campaña: {value || 'mi-campana'}.{DOMINIO_BASE}
        </p>
      )}

      {/* Preview de URL cuando es válido */}
      {valido && tocado && (
        <p className="text-slate-500 text-xs mt-1.5">
          URL: <strong className="text-slate-700">{value}.{DOMINIO_BASE}</strong>
        </p>
      )}
    </div>
  )
}
