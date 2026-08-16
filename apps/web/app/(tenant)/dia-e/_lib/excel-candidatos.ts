/**
 * Carga masiva de candidatos del tarjetón (para el E-14). Sirve sobre todo para
 * concejo / JAL, donde hay decenas. Solo texto: nombre, agrupación y número; las
 * fotos y logos se completan luego en la configuración, candidato por candidato.
 * xlsx solo en el servidor.
 */

import * as XLSX from 'xlsx'
import type { PrismaClient } from '@vectra/db'

export interface ImportCandidatosResult {
  created: number
  skipped: number
  errors:  string[]
}

const COLUMNAS = ['nombre', 'agrupacion', 'numero']

export function generarPlantillaCandidatos(): Buffer {
  const wb = XLSX.utils.book_new()
  const datos = [
    COLUMNAS,
    ['Carlos Pérez', 'Partido Ejemplo', '1'],
    ['Ana Gómez', 'Movimiento Ejemplo', '2'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(datos)
  ws['!cols'] = COLUMNAS.map(() => ({ wch: 24 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Candidatos')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

/** Crea los candidatos rivales (isOwn: false). Dedup por nombre (case-insensitive)
 *  para que reimportar no duplique. El candidato propio no se toca (viene de CORE). */
export async function procesarImportCandidatos(
  buffer:   Buffer,
  tenantId: string,
  db:       PrismaClient,
): Promise<ImportCandidatosResult> {
  const wb    = XLSX.read(buffer, { type: 'buffer' })
  const ws    = wb.Sheets[wb.SheetNames[0]]
  const tabla = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]
  if (tabla.length < 2) return { created: 0, skipped: 0, errors: ['El archivo no contiene datos.'] }

  const enc = (tabla[0] ?? []).map((h) => String(h).toLowerCase().trim())
  const idx = { nombre: enc.indexOf('nombre'), agrupacion: enc.indexOf('agrupacion'), numero: enc.indexOf('numero') }
  if (idx.nombre === -1) return { created: 0, skipped: 0, errors: ['El Excel debe tener una columna "nombre".'] }

  const existentes = new Set(
    (await db.candidate.findMany({ where: { tenantId }, select: { name: true } }))
      .map((c) => c.name.toLowerCase().trim()),
  )

  const filas = tabla.slice(1).filter((r) => r.some((c) => String(c).trim()))
  let created = 0, skipped = 0
  const errors: string[] = []

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]
    const linea = i + 2
    const name = String(fila[idx.nombre] ?? '').trim()
    if (!name) { errors.push(`Fila ${linea}: falta el nombre.`); continue }
    if (existentes.has(name.toLowerCase())) { skipped++; continue }

    const party = idx.agrupacion !== -1 ? String(fila[idx.agrupacion] ?? '').trim() : ''
    const order = idx.numero !== -1 ? (parseInt(String(fila[idx.numero] ?? '')) || 0) : 0

    try {
      await db.candidate.create({ data: { tenantId, name, party: party || null, isOwn: false, order } })
      existentes.add(name.toLowerCase())
      created++
    } catch (err) {
      errors.push(`Fila ${linea}: error al crear ${name} — ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { created, skipped, errors }
}
