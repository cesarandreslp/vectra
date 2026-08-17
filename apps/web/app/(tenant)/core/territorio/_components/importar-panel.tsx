'use client'

/**
 * Carga masiva de territorio por Excel (comunas/zonas, barrios, puestos,
 * mesas) — para campañas fuera de Buga, donde no hay datos DIVIPOLA a ese
 * nivel y todo se sembró a mano. Cada hoja es opcional e idempotente.
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface ImportResult {
  zonas?:  { created: number }
  comunas: { created: number; skipped: number }
  barrios: { created: number; skipped: number }
  puestos: { created: number; skipped: number }
  mesas:   { created: number; skipped: number }
  errors:  string[]
}

export function ImportarPanel({ municipalityId }: { municipalityId: string }) {
  const [archivo, setArchivo]     = useState<File | null>(null)
  const [archivoNom, setArchivoNom] = useState('')
  const [resultado, setResultado] = useState<ImportResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setArchivo(f); setArchivoNom(f.name); setResultado(null); setError(null)
  }

  function importar() {
    if (!archivo) return
    setError(null)

    const fd = new FormData()
    fd.append('file', archivo)
    fd.append('municipalityId', municipalityId)

    startTransition(async () => {
      const res = await fetch('/api/core/territorio/importar-excel', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Error al importar.')
        return
      }
      const data: ImportResult = await res.json()
      setResultado(data)
      setArchivo(null); setArchivoNom('')
      if (inputRef.current) inputRef.current.value = ''
      router.refresh()
    })
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem' }}>Cargar territorio por Excel</h2>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '1rem' }}>
        Para municipios sin comunas/puestos precargados. Un archivo con hasta 4 hojas
        (Comunas, Barrios, Puestos, Mesas) — puedes subir solo las que necesites, y
        recargar el mismo archivo no duplica lo que ya existe.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <a
          href="/api/core/territorio/plantilla-excel" download
          style={{
            display: 'inline-block', background: '#f1f5f9', color: '#475569',
            padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0',
            textDecoration: 'none', fontSize: '0.875rem',
          }}
        >
          Descargar plantilla Excel
        </a>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleArchivo} style={{ display: 'none' }} id="territorio-xlsx-input" />
        <label
          htmlFor="territorio-xlsx-input"
          style={{
            cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: 6, border: '1px dashed #cbd5e1',
            fontSize: '0.875rem', color: '#475569', background: '#fafafa',
          }}
        >
          {archivoNom || 'Seleccionar archivo Excel (.xlsx)'}
        </label>
        <button
          onClick={importar} disabled={isPending || !archivo}
          style={{
            background: (isPending || !archivo) ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none',
            padding: '0.5rem 1rem', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600,
            cursor: (isPending || !archivo) ? 'not-allowed' : 'pointer',
          }}
        >
          {isPending ? 'Importando...' : 'Importar'}
        </button>
      </div>

      {error && <p style={{ color: '#991b1b', fontSize: '0.8rem', marginTop: '0.75rem' }}>{error}</p>}

      {resultado && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <Stat label="Comunas" r={resultado.comunas} />
            <Stat label="Barrios" r={resultado.barrios} />
            {resultado.zonas && <Stat label="Zonas electorales" r={{ created: resultado.zonas.created, skipped: 0 }} />}
            <Stat label="Puestos" r={resultado.puestos} />
            <Stat label="Mesas" r={resultado.mesas} />
          </div>
          {resultado.errors.length > 0 && (
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#991b1b', marginBottom: '0.35rem' }}>
                Filas con error:
              </div>
              <ul style={{ fontSize: '0.78rem', color: '#991b1b', paddingLeft: '1.25rem', margin: 0 }}>
                {resultado.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                {resultado.errors.length > 20 && <li>...y {resultado.errors.length - 20} más.</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, r }: { label: string; r: { created: number; skipped: number } }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.5rem 0.9rem', background: '#f8fafc', borderRadius: 6, minWidth: 100 }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>+{r.created}</div>
      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{label} {r.skipped > 0 && `(${r.skipped} ya existían)`}</div>
    </div>
  )
}
