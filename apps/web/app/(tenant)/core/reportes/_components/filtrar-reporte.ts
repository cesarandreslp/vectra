import type { Reporte } from '../actions'

type Celda = string | number

/**
 * Columnas que merecen lista desplegable: solo texto, con entre 2 y 40 valores
 * distintos que se repitan (zona, estado, líder, puesto…). Un nombre propio por
 * fila o una celda numérica no sirve de filtro de lista: para eso está el buscador.
 */
export function columnasFiltrables(reporte: Reporte): { indice: number; valores: string[] }[] {
  return reporte.columnas.flatMap((_, i) => {
    const celdas = reporte.filas.map((f) => f[i])
    if (celdas.some((c) => typeof c !== 'string')) return []
    const valores = [...new Set(celdas as string[])].filter(Boolean).sort((a, b) => a.localeCompare(b))
    const repetidos = valores.length <= Math.max(2, celdas.length * 0.6)
    return valores.length >= 2 && valores.length <= 40 && repetidos ? [{ indice: i, valores }] : []
  })
}

export interface Filtro {
  texto:   string
  /** índice de columna → valor elegido */
  columnas: Record<number, string>
  orden:   { indice: number; asc: boolean } | null
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function aplicarFiltro(filas: Celda[][], f: Filtro): Celda[][] {
  const texto = normalizar(f.texto.trim())
  const out = filas.filter((fila) =>
    (!texto || fila.some((c) => normalizar(String(c)).includes(texto))) &&
    Object.entries(f.columnas).every(([i, v]) => !v || fila[Number(i)] === v),
  )
  if (!f.orden) return out
  const { indice, asc } = f.orden
  return [...out].sort((a, b) => {
    const x = a[indice], y = b[indice]
    const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es', { numeric: true })
    return asc ? cmp : -cmp
  })
}

/**
 * Totales de lo filtrado: se suman las columnas numéricas; las de texto
 * compuesto ("3 de 5", "40 %") no se pueden sumar y quedan en blanco.
 */
export function totalesFiltrados(reporte: Reporte, filas: Celda[][]): Celda[] {
  return reporte.columnas.map((_, i) => {
    if (i === 0) return 'Total (filtrado)'
    const numericas = reporte.filas.every((f) => typeof f[i] === 'number')
    return numericas ? filas.reduce((a, f) => a + (f[i] as number), 0) : ''
  })
}
