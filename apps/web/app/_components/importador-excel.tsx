'use client'

import { useState } from 'react'

interface ResultadoBase { created: number; skipped: number; errors: string[] }

/**
 * Importador genérico por Excel: plantilla + subir + resultado. Reusable por
 * testigos, candidatos, staff, etc. — cada uno solo pasa sus URLs y textos.
 */
export function ImportadorExcel<R extends ResultadoBase>({
  plantillaUrl, importarUrl, titulo, descripcion, botonAbrir, extraResultado,
}: {
  plantillaUrl: string
  importarUrl:  string
  titulo:       string
  descripcion:  React.ReactNode
  /** Texto del botón que despliega el importador. */
  botonAbrir:   string
  /** Render opcional de líneas extra del resultado (ej. duplicados). */
  extraResultado?: (res: R) => React.ReactNode
}) {
  const [abierto, setAbierto]   = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [res, setRes]           = useState<R | null>(null)
  const [error, setError]       = useState<string | null>(null)

  async function subir(file: File) {
    setSubiendo(true); setError(null); setRes(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch(importarUrl, { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) { setError(data.error ?? 'Error al importar.'); return }
      setRes(data)
    } catch {
      setError('Error de conexión al subir el archivo.')
    } finally { setSubiendo(false) }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)}
        style={{ alignSelf: 'flex-start', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, color: '#334155' }}>
        {botonAbrir}
      </button>
    )
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.95rem' }}>{titulo}</strong>
        <button onClick={() => setAbierto(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}>Cerrar</button>
      </div>

      <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>{descripcion}</p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <a href={plantillaUrl}
          style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: '0.8rem', color: '#334155', textDecoration: 'none', fontWeight: 600 }}>
          Descargar plantilla
        </a>
        <label style={{ background: '#0f172a', color: '#fff', borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: '0.8rem', cursor: subiendo ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: subiendo ? 0.6 : 1 }}>
          {subiendo ? 'Importando…' : 'Subir archivo'}
          <input type="file" accept=".xlsx" disabled={subiendo}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f); e.target.value = '' }}
            style={{ display: 'none' }} />
        </label>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '0.5rem 0.7rem', fontSize: '0.8rem' }}>{error}</div>}

      {res && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>
            ✓ {res.created} creado(s){res.skipped ? ` · ${res.skipped} omitido(s)` : ''}
          </div>
          {extraResultado?.(res)}
          {res.errors.length > 0 && (
            <div style={{ background: '#fef3c7', borderRadius: 6, padding: '0.5rem 0.7rem', fontSize: '0.75rem', color: '#92400e', maxHeight: 160, overflowY: 'auto' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{res.errors.length} fila(s) con problemas:</div>
              {res.errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Recargá la página para ver los cambios.</span>
        </div>
      )}
    </div>
  )
}
