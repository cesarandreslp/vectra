'use client'

import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import type { Reporte } from '../actions'
import { BotonImprimir, ESTILO_IMPRESION } from './imprimir'
import { columnasFiltrables, aplicarFiltro, totalesFiltrados, type Filtro } from './filtrar-reporte'

/**
 * Un reporte como tabla, con buscador, filtros por columna, orden por
 * encabezado, descarga a Excel e impresión. Excel e impresión llevan solo lo
 * filtrado, y los totales se recalculan sobre eso.
 */
export function TablaReporte({ reporte }: { reporte: Reporte }) {
  const [filtro, setFiltro] = useState<Filtro>({ texto: '', columnas: {}, orden: null })
  const filtrables = useMemo(() => columnasFiltrables(reporte), [reporte])
  const filas = useMemo(() => aplicarFiltro(reporte.filas, filtro), [reporte.filas, filtro])
  const hayFiltro = filtro.texto.trim() !== '' || Object.values(filtro.columnas).some(Boolean)
  const totales = hayFiltro && reporte.totales ? totalesFiltrados(reporte, filas) : reporte.totales

  function descargarExcel() {
    const todo = [reporte.columnas, ...filas, ...(totales ? [totales] : [])]
    const hoja = XLSX.utils.aoa_to_sheet(todo)
    hoja['!cols'] = reporte.columnas.map((_, i) => ({ wch: Math.min(60, Math.max(10, ...todo.map((f) => String(f[i] ?? '').length))) }))
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, reporte.titulo.slice(0, 31)) // Excel limita el nombre de hoja a 31
    XLSX.writeFile(libro, `${reporte.titulo.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function ordenarPor(indice: number) {
    setFiltro((f) => ({ ...f, orden: f.orden?.indice === indice ? { indice, asc: !f.orden.asc } : { indice, asc: true } }))
  }

  return (
    <div className="area-impresion">
      <style>{ESTILO_IMPRESION}</style>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{reporte.titulo}</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>{reporte.descripcion}</p>
          <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
            Generado el {new Date().toLocaleString('es-CO')}{hayFiltro && ` · filtrado: ${filas.length} de ${reporte.filas.length} filas`}
          </p>
        </div>
        <div className="no-imprimir" style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={descargarExcel} disabled={filas.length === 0} style={boton}>Descargar Excel</button>
          <BotonImprimir />
        </div>
      </div>

      {reporte.filas.length > 0 && (
        <div className="no-imprimir" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <input
            type="search" value={filtro.texto} placeholder="Buscar en cualquier columna…"
            onChange={(e) => setFiltro((f) => ({ ...f, texto: e.target.value }))}
            style={{ ...campo, flex: '1 1 220px', maxWidth: 320 }}
          />
          {filtrables.map(({ indice, valores }) => (
            <select
              key={indice} value={filtro.columnas[indice] ?? ''} style={{ ...campo, maxWidth: 220 }}
              onChange={(e) => setFiltro((f) => ({ ...f, columnas: { ...f.columnas, [indice]: e.target.value } }))}
            >
              <option value="">{reporte.columnas[indice]}: todos</option>
              {valores.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          ))}
          {hayFiltro && (
            <button type="button" onClick={() => setFiltro({ texto: '', columnas: {}, orden: filtro.orden })}
              style={{ ...campo, background: 'none', cursor: 'pointer', color: '#1e40af' }}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {reporte.filas.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>No hay datos para este reporte todavía.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                {reporte.columnas.map((c, i) => (
                  <th key={c} onClick={() => ordenarPor(i)} title="Ordenar" style={{ ...celda, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {c}{filtro.orden?.indice === i ? (filtro.orden.asc ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                  {f.map((v, j) => <td key={j} style={{ ...celda, textAlign: typeof v === 'number' ? 'right' : 'left' }}>{v}</td>)}
                </tr>
              ))}
              {filas.length === 0 && (
                <tr><td colSpan={reporte.columnas.length} style={{ ...celda, color: '#94a3b8' }}>Ninguna fila coincide con el filtro.</td></tr>
              )}
            </tbody>
            {totales && (
              <tfoot>
                <tr style={{ borderTop: '2px solid #cbd5e1', fontWeight: 700, background: '#f8fafc' }}>
                  {totales.map((v, j) => <td key={j} style={{ ...celda, textAlign: typeof v === 'number' ? 'right' : 'left' }}>{v}</td>)}
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
const campo: React.CSSProperties = { padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.82rem', background: '#fff' }
const boton: React.CSSProperties = {
  background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 0.9rem',
  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
}
