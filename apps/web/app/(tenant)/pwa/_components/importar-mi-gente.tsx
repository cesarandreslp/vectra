'use client'

import { useState } from 'react'

interface Resultado { created: number; skipped: number; duplicates: number; errors: string[] }

/** El elector sube a su propia gente desde la PWA. Todo queda bajo él; a quien
 *  ya esté bajo otro líder se le avisa (no se roba, queda como alerta). */
export function ImportarMiGente() {
  const [abierto, setAbierto]   = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [res, setRes]           = useState<Resultado | null>(null)
  const [error, setError]       = useState<string | null>(null)

  async function subir(file: File) {
    setSubiendo(true); setError(null); setRes(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/pwa/importar-electores', { method: 'POST', body: fd })
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
        style={{ width: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.75rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, color: '#334155', marginBottom: '1rem' }}>
        ⬆ Subir mi lista de gente (Excel)
      </button>
    )
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.9rem', background: '#fff', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.9rem' }}>Subir mi gente</strong>
        <button onClick={() => setAbierto(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}>Cerrar</button>
      </div>
      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
        Descarga la plantilla, llénala con tu gente y súbela. Todos quedan <strong>bajo vos</strong>.
        Si alguien ya está registrado bajo otro, te avisamos y no se duplica.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <a href="/api/pwa/plantilla-electores"
          style={{ flex: 1, textAlign: 'center', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, padding: '0.5rem', fontSize: '0.8rem', color: '#334155', textDecoration: 'none', fontWeight: 600 }}>
          Plantilla
        </a>
        <label style={{ flex: 1, textAlign: 'center', background: '#0f172a', color: '#fff', borderRadius: 8, padding: '0.5rem', fontSize: '0.8rem', cursor: subiendo ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: subiendo ? 0.6 : 1 }}>
          {subiendo ? 'Subiendo…' : 'Subir'}
          <input type="file" accept=".xlsx" disabled={subiendo}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f); e.target.value = '' }}
            style={{ display: 'none' }} />
        </label>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '0.5rem', fontSize: '0.78rem' }}>{error}</div>}

      {res && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem' }}>
          <div style={{ fontWeight: 600, color: '#166534' }}>✓ {res.created} agregado(s) a tu gente</div>
          {res.duplicates > 0 && (
            <div style={{ color: '#b45309' }}>⚠ {res.duplicates} ya estaba(n) bajo otro líder — quedó registrado como alerta, no se movió.</div>
          )}
          {res.skipped > 0 && <div style={{ color: '#94a3b8' }}>{res.skipped} ya eran tuyos.</div>}
          {res.errors.length > 0 && (
            <div style={{ background: '#fef3c7', borderRadius: 6, padding: '0.5rem', fontSize: '0.72rem', color: '#92400e', maxHeight: 140, overflowY: 'auto' }}>
              {res.errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
