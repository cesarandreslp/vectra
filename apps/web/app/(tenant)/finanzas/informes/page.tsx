'use client'

import { useState, useEffect } from 'react'
import { listReports } from '../actions'
import type { ReportView } from '../actions'

const TYPE_LABELS: Record<string, string> = {
  PARCIAL: 'Parcial',
  FINAL:   'Final',
  CNE:     'CNE',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  BORRADOR:   { bg: '#f1f5f9', color: '#334155' },
  GENERADO:   { bg: '#dbeafe', color: '#1e40af' },
  PRESENTADO: { bg: '#dcfce7', color: '#166534' },
}

export default function InformesPage() {
  const [reports, setReports]     = useState<ReportView[]>([])
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [confirmType, setConfirmType] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    try {
      const data = await listReports()
      setReports(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate(type: string) {
    setGenerating(type)
    setError(null)
    setConfirmType(null)

    try {
      const res = await fetch('/api/finanzas/generar-informe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      // Recargar la lista
      await loadReports()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar informe')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
        Informes financieros
      </h1>

      {error && (
        <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Botones de generación */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {(['PARCIAL', 'FINAL', 'CNE'] as const).map(type => (
          <button
            key={type}
            onClick={() => setConfirmType(type)}
            disabled={generating !== null}
            style={{
              padding: '0.7rem 1.5rem', fontSize: '0.85rem', borderRadius: '6px',
              border: 'none', fontWeight: 600, cursor: generating ? 'wait' : 'pointer',
              background: type === 'CNE' ? '#1e40af' : type === 'FINAL' ? '#0f172a' : '#334155',
              color: '#fff',
            }}
          >
            {generating === type ? 'Generando...' : `Generar informe ${TYPE_LABELS[type].toLowerCase()}`}
          </button>
        ))}
      </div>

      {/* Modal de confirmación */}
      {confirmType && (
        <div style={{
          padding: '1.25rem', background: '#f0f9ff', border: '1px solid #bae6fd',
          borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#0c4a6e' }}>
            Se generará un <strong>informe {TYPE_LABELS[confirmType]?.toLowerCase()}</strong> con todos
            los gastos y donaciones registrados hasta la fecha. El PDF se almacenará y quedará
            disponible para descarga.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              onClick={() => handleGenerate(confirmType)}
              style={{
                padding: '0.5rem 1.25rem', fontSize: '0.85rem', borderRadius: '6px',
                border: 'none', background: '#1e40af', color: '#fff',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              Confirmar generación
            </button>
            <button
              onClick={() => setConfirmType(null)}
              style={{
                padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '6px',
                border: '1px solid #cbd5e1', background: '#fff', color: '#334155',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Spinner */}
      {generating && (
        <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
          Generando PDF... esto puede tomar unos segundos.
        </div>
      )}

      {/* Lista de informes */}
      <div style={{
        background: '#fff', borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Tipo', 'Período', 'Gastos', 'Donaciones', 'Balance', 'Estado', 'Fecha', 'Descargar'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  Cargando...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  No hay informes generados
                </td>
              </tr>
            ) : reports.map(r => {
              const statusColor = STATUS_COLORS[r.status] ?? { bg: '#f1f5f9', color: '#334155' }
              return (
                <tr key={r.id}>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.1rem 0.4rem', borderRadius: '9999px',
                      fontSize: '0.65rem', fontWeight: 600,
                      background: '#dbeafe', color: '#1e40af',
                    }}>
                      {TYPE_LABELS[r.type] ?? r.type}
                    </span>
                  </td>
                  <td style={tdStyle}>{r.period}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    ${r.totalExpenses.toLocaleString('es-CO')}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    ${r.totalDonations.toLocaleString('es-CO')}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: r.balance >= 0 ? '#22c55e' : '#dc2626' }}>
                    ${r.balance.toLocaleString('es-CO')}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.1rem 0.4rem', borderRadius: '9999px',
                      fontSize: '0.65rem', fontWeight: 600,
                      background: statusColor.bg, color: statusColor.color,
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: '#64748b' }}>
                    {r.generatedAt ? new Date(r.generatedAt).toLocaleDateString('es-CO') : '—'}
                  </td>
                  <td style={tdStyle}>
                    {r.fileUrl ? (
                      <a
                        href={r.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#1e40af', fontSize: '0.8rem' }}
                      >
                        Descargar PDF
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.7rem',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9',
}
