'use client'

/**
 * Página de importación de electores — Excel bidireccional.
 *
 * Flujo:
 *   1. Descargar plantilla Excel (.xlsx)
 *   2. Rellenar y subir el archivo
 *   3. Preview de las primeras 5 filas (POST ?preview=true — sin persistir)
 *   4. Confirmar → POST sin flag → procesa e importa
 *   5. Resultado: creados · saltados · duplicados · errores
 */

import { useState, useRef, useTransition } from 'react'
import Link from 'next/link'

interface Preview {
  headers: string[]
  rows:    string[][]
  total:   number
}

interface ImportResult {
  created:    number
  skipped:    number
  duplicates: number
  errors:     string[]
}

export default function ImportarPage() {
  const [leaderId,   setLeaderId]   = useState('')
  const [preview,    setPreview]    = useState<Preview | null>(null)
  const [archivoNom, setArchivoNom] = useState('')
  const [archivo,    setArchivo]    = useState<File | null>(null)
  const [resultado,  setResultado]  = useState<ImportResult | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const inputRef                    = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setArchivo(f)
    setArchivoNom(f.name)
    setPreview(null)
    setResultado(null)
    setError(null)
  }

  async function handlePreview() {
    if (!archivo) return
    setError(null)

    const fd = new FormData()
    fd.append('file',     archivo)
    fd.append('leaderId', leaderId || '__none__')

    startTransition(async () => {
      const res = await fetch('/api/core/importar-excel?preview=true', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Error al leer el archivo.')
        return
      }
      const data: Preview = await res.json()
      if (!data.total) {
        setError('El archivo no contiene datos válidos.')
        return
      }
      setPreview(data)
    })
  }

  function handleImportar() {
    if (!archivo || !leaderId) return
    setError(null)

    const fd = new FormData()
    fd.append('file',     archivo)
    fd.append('leaderId', leaderId)

    startTransition(async () => {
      const res = await fetch('/api/core/importar-excel', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Error al importar.')
        return
      }
      const data: ImportResult = await res.json()
      setResultado(data)
      setPreview(null)
      setArchivo(null)
      setArchivoNom('')
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  function limpiar() {
    setArchivo(null); setArchivoNom(''); setPreview(null); setResultado(null); setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Importar electores</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Descarga la plantilla, complétala y súbela. Las cédulas se cifran automáticamente.
        Los duplicados entre líderes generan alertas automáticas.
      </p>

      {/* Botón descargar plantilla */}
      <div style={{ marginBottom: '1.5rem' }}>
        <a
          href="/api/core/plantilla-excel"
          download
          style={{
            display: 'inline-block', background: '#f1f5f9', color: '#475569',
            padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0',
            textDecoration: 'none', fontSize: '0.875rem',
          }}
        >
          Descargar plantilla Excel
        </a>
      </div>

      {/* Columnas esperadas */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>Columnas del Excel (en este orden):</div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['nombre', 'cedula', 'telefono', 'direccion', 'lider_id', 'puesto_id', 'mesa_id'].map((c) => (
            <code key={c} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.78rem' }}>{c}</code>
          ))}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>Solo nombre y cedula son obligatorios.</div>
      </div>

      {/* Selector de líder asignado */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
          ID del líder asignado a estos electores *
        </label>
        <input
          type="text"
          value={leaderId}
          onChange={e => setLeaderId(e.target.value)}
          placeholder="Pegar el ID del líder desde la ficha del líder"
          style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }}
        />
      </div>

      {/* Upload */}
      <div
        style={{
          border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '2rem',
          textAlign: 'center', marginBottom: '1rem', background: '#fafafa',
        }}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleArchivo} style={{ display: 'none' }} id="xlsx-input" />
        <label htmlFor="xlsx-input" style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
          <div style={{ fontSize: '0.875rem', color: '#475569' }}>
            {archivoNom || 'Haz clic para seleccionar archivo Excel (.xlsx)'}
          </div>
        </label>
      </div>

      {/* Botones de acción */}
      {archivo && !preview && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <button
            onClick={handlePreview} disabled={isPending}
            style={{
              background: isPending ? '#94a3b8' : '#0f172a', color: '#fff',
              padding: '0.625rem 1.25rem', borderRadius: '6px', border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            {isPending ? 'Leyendo...' : 'Ver preview'}
          </button>
          <button onClick={limpiar} style={{ background: 'transparent', color: '#64748b', padding: '0.625rem 1.25rem', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.875rem' }}>
            Cancelar
          </button>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Vista previa — {preview.total} registros a importar
          </div>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {preview.headers.map((h, i) => (
                    <th key={i} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((fila, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {fila.map((cel, j) => <td key={j} style={{ padding: '0.5rem 0.75rem' }}>{cel}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.total > 5 && (
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem', textAlign: 'center' }}>
                Mostrando 5 de {preview.total} filas
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleImportar} disabled={isPending || !leaderId}
              style={{
                background: (isPending || !leaderId) ? '#94a3b8' : '#0f172a', color: '#fff',
                padding: '0.625rem 1.25rem', borderRadius: '6px', border: 'none',
                cursor: (isPending || !leaderId) ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600,
              }}
            >
              {isPending ? 'Importando...' : `Confirmar e importar ${preview.total} registros`}
            </button>
            <button onClick={limpiar} style={{ background: 'transparent', color: '#64748b', padding: '0.625rem 1.25rem', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.875rem' }}>
              Cancelar
            </button>
          </div>
          {!leaderId && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem' }}>Debes ingresar el ID del líder antes de importar.</div>}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Resultado de la importación</div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <StatCard label="Creados"     valor={resultado.created}    color="#166534" bg="#dcfce7" />
            <StatCard label="Saltados"    valor={resultado.skipped}    color="#854d0e" bg="#fef9c3" />
            <StatCard label="Duplicados"  valor={resultado.duplicates} color="#991b1b" bg="#fee2e2" />
            <StatCard label="Errores"     valor={resultado.errors.length} color="#475569" bg="#f1f5f9" />
          </div>

          {resultado.duplicates > 0 && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '0.75rem', fontSize: '0.875rem', color: '#9a3412' }}>
              Se detectaron {resultado.duplicates} cédula(s) ya registradas con otro líder.{' '}
              <Link href="/core/alertas" style={{ color: '#1e40af' }}>Ver alertas de duplicados →</Link>
            </div>
          )}

          {resultado.errors.length > 0 && (
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#991b1b', marginBottom: '0.5rem' }}>Errores de validación:</div>
              <ul style={{ fontSize: '0.8rem', color: '#991b1b', paddingLeft: '1.25rem', margin: 0 }}>
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

function StatCard({ label, valor, color, bg }: { label: string; valor: number; color: string; bg: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.75rem 1rem', background: bg, borderRadius: '6px', minWidth: '100px' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{valor}</div>
      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{label}</div>
    </div>
  )
}
