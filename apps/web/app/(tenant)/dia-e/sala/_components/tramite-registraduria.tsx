'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  exportarListadoPropuesto,
  compararConAprobado,
  aplicarCorreccionesRegistraduria,
} from '../../actions'
import type { ResultadoComparacion } from '../../_lib/registraduria'

const COLOR_TIPO: Record<string, { bg: string; text: string }> = {
  SIN_CAMBIO:    { bg: '#dcfce7', text: '#166534' },
  MESA_CAMBIADA: { bg: '#fef3c7', text: '#92400e' },
  RECHAZADO:     { bg: '#fee2e2', text: '#991b1b' },
  NO_RECONOCIDO: { bg: '#f1f5f9', text: '#64748b' },
}

/**
 * Los tres momentos del trámite:
 *   1. se descarga el PROPUESTO y se radica en la Registraduría,
 *   2. se sube el APROBADO que ellos devuelven,
 *   3. se aplican las correcciones — solo se tocan los testigos que cambiaron.
 */
export function TramiteRegistraduria() {
  const router = useRouter()
  const [resultado, setResultado] = useState<ResultadoComparacion | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [aviso, setAviso]         = useState<string | null>(null)
  const [pendiente, startTransition] = useTransition()

  function descargar() {
    startTransition(async () => {
      const csv = await exportarListadoPropuesto()
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'testigos-propuestos.csv'
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  function comparar(formData: FormData) {
    setError(null); setAviso(null); setResultado(null)
    startTransition(async () => {
      const r = await compararConAprobado(formData)
      if (r.success) setResultado(r.resultado)
      else setError(r.error)
    })
  }

  function aplicar() {
    if (!resultado) return
    startTransition(async () => {
      const r = await aplicarCorreccionesRegistraduria(
        resultado.diferencias
          .filter(d => d.assignmentId)
          .map(d => ({
            assignmentId:          d.assignmentId as string,
            tipo:                  d.tipo,
            votingTableIdAprobado: d.votingTableIdAprobado,
          })),
      )
      if (!r.success) { setError(r.error ?? 'No se pudieron aplicar.'); return }
      setResultado(null)
      setAviso(`${r.aplicados} testigo(s) actualizados con la respuesta de la Registraduría.`)
      router.refresh()
    })
  }

  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1.25rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
    }}>
      <h2 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>Trámite ante la Registraduría</h2>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={descargar} disabled={pendiente} style={botonSecundario}>
          1. Descargar listado propuesto
        </button>

        <form action={comparar} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="file" name="archivo" accept=".xlsx,.xls,.csv" required
            style={{ fontSize: '0.75rem' }}
          />
          <button type="submit" disabled={pendiente} style={botonSecundario}>
            2. Comparar con el aprobado
          </button>
        </form>
      </div>

      {error && <div style={{ color: '#991b1b', fontSize: '0.8rem' }}>{error}</div>}
      {aviso && <div style={{ color: '#166534', fontSize: '0.8rem' }}>{aviso}</div>}

      {resultado && (
        <>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
            <span>Sin cambio: <strong>{resultado.sinCambio}</strong></span>
            <span style={{ color: '#92400e' }}>Mesa cambiada: <strong>{resultado.mesaCambiada}</strong></span>
            <span style={{ color: '#991b1b' }}>Rechazados: <strong>{resultado.rechazados}</strong></span>
            <span style={{ color: '#64748b' }}>No reconocidos: <strong>{resultado.noReconocidos}</strong></span>
          </div>

          {resultado.sinCedula.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#92400e' }}>
              Sin cédula (no se pudieron cruzar): {resultado.sinCedula.join(', ')}
            </div>
          )}

          <div style={{ maxHeight: '20rem', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Testigo', 'Cambio', 'Mesa actual', 'Mesa aprobada', 'Detalle'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultado.diferencias.map((d, i) => {
                  const c = COLOR_TIPO[d.tipo]
                  return (
                    <tr key={i}>
                      <td style={tdStyle}>{d.nombre}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '0.1rem 0.45rem', borderRadius: '9999px',
                          fontSize: '0.7rem', fontWeight: 600, background: c.bg, color: c.text,
                        }}>
                          {d.tipo.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={tdStyle}>{d.mesaActual ?? '—'}</td>
                      <td style={tdStyle}>{d.mesaAprobada ?? '—'}</td>
                      <td style={{ ...tdStyle, color: '#64748b' }}>{d.detalle}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button onClick={aplicar} disabled={pendiente} style={{
            ...botonSecundario, background: '#1e40af', color: '#fff', alignSelf: 'flex-start',
          }}>
            {pendiente ? 'Aplicando…' : '3. Aceptar correcciones'}
          </button>
        </>
      )}
    </div>
  )
}

const botonSecundario: React.CSSProperties = {
  padding: '0.4rem 0.9rem', fontSize: '0.8rem', borderRadius: '6px',
  border: '1px solid #1e40af', background: '#fff', color: '#1e40af',
  cursor: 'pointer', fontWeight: 600,
}
const thStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem', textAlign: 'left', fontSize: '0.7rem',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.35rem 0.6rem', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9',
}
