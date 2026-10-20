'use client'

import * as XLSX from 'xlsx'
import type { Reporte } from '../actions'
import { BotonImprimir, ESTILO_IMPRESION } from './imprimir'

/** Un reporte como tabla, con descarga a Excel e impresión (solo el reporte, sin el menú). */
export function TablaReporte({ reporte }: { reporte: Reporte }) {
  function descargarExcel() {
    const filas = [reporte.columnas, ...reporte.filas, ...(reporte.totales ? [reporte.totales] : [])]
    const hoja = XLSX.utils.aoa_to_sheet(filas)
    hoja['!cols'] = reporte.columnas.map((_, i) => ({ wch: Math.min(60, Math.max(10, ...filas.map((f) => String(f[i] ?? '').length))) }))
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, reporte.titulo.slice(0, 31)) // Excel limita el nombre de hoja a 31
    XLSX.writeFile(libro, `${reporte.titulo.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="area-impresion">
      <style>{ESTILO_IMPRESION}</style>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{reporte.titulo}</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>{reporte.descripcion}</p>
          <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>Generado el {new Date().toLocaleString('es-CO')}</p>
        </div>
        <div className="no-imprimir" style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={descargarExcel} disabled={reporte.filas.length === 0} style={boton('#166534')}>Descargar Excel</button>
          <BotonImprimir />
        </div>
      </div>

      {reporte.filas.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>No hay datos para este reporte todavía.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                {reporte.columnas.map((c) => <th key={c} style={celda}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {reporte.filas.map((f, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                  {f.map((v, j) => <td key={j} style={{ ...celda, textAlign: typeof v === 'number' ? 'right' : 'left' }}>{v}</td>)}
                </tr>
              ))}
            </tbody>
            {reporte.totales && (
              <tfoot>
                <tr style={{ borderTop: '2px solid #cbd5e1', fontWeight: 700, background: '#f8fafc' }}>
                  {reporte.totales.map((v, j) => <td key={j} style={{ ...celda, textAlign: typeof v === 'number' ? 'right' : 'left' }}>{v}</td>)}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

const celda: React.CSSProperties = { padding: '0.45rem 0.65rem', verticalAlign: 'top' }

function boton(color: string): React.CSSProperties {
  return { background: color, color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }
}
