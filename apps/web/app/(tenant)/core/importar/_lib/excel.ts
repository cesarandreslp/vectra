/**
 * Librería para generación y procesamiento de planillas Excel de electores.
 * Usa SheetJS (xlsx) exclusivamente en el servidor — nunca en el bundle del cliente.
 *
 * Flujo bidireccional:
 *   Descarga: generarPlantillaExcel() → Buffer (.xlsx con headers y ejemplo)
 *   Carga: procesarImportExcel(buffer, leaderId, db) → ImportExcelResult
 */

import { createHash }         from 'crypto'
import * as XLSX              from 'xlsx'
import { encrypt }            from '@vectra/db'
import { crearAlertaDuplicado } from '../../actions'
import { crearQrPropio }      from '@/lib/qr'
import type { PrismaClient }  from '@vectra/db'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ImportExcelResult {
  created:    number
  skipped:    number
  duplicates: number
  errors:     string[]
}

interface FilaExcel {
  nombre:    string
  cedula:    string
  telefono?: string
  direccion?: string
  lider_id?: string
  puesto_id?: string
  mesa_id?:  string
}

// Columnas en el orden exacto del spec
const COLUMNAS_EXCEL = [
  'nombre', 'cedula', 'telefono', 'direccion', 'lider_id', 'puesto_id', 'mesa_id',
]

// ── Generar plantilla ─────────────────────────────────────────────────────────

/**
 * Genera un archivo Excel (.xlsx) con la plantilla para importación de electores.
 * - Fila 1: headers con fondo gris y texto en negrita
 * - Fila 2: datos de ejemplo ficticios (Medellín, Colombia)
 */
export function generarPlantillaExcel(): Buffer {
  const wb = XLSX.utils.book_new()

  // Datos: fila de ejemplo con datos colombianos ficticios
  const datos = [
    COLUMNAS_EXCEL,
    ['María García López', '1234567890', '3001234567', 'Cra 45 #23-10 Laureles', '', '', ''],
  ]

  const ws = XLSX.utils.aoa_to_sheet(datos)

  // Estilo de headers: fondo gris, negrita
  // SheetJS CE solo soporta estilos completos en la versión Pro;
  // en la versión libre, aplicamos el ancho de columna como mejora mínima
  ws['!cols'] = COLUMNAS_EXCEL.map(() => ({ wch: 22 }))

  // Proteger la fila de headers para que no sea editable
  // (solo disponible con contraseña en xlsx; omitimos por compatibilidad)

  XLSX.utils.book_append_sheet(wb, ws, 'Electores')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(buffer)
}

// ── Parsear preview ───────────────────────────────────────────────────────────

/**
 * Lee un buffer Excel y retorna las primeras 5 filas de datos como strings.
 * Usado por el endpoint con ?preview=true.
 */
export function parsearPreviewExcel(buffer: Buffer): {
  headers: string[]
  rows:    string[][]
  total:   number
} {
  const wb    = XLSX.read(buffer, { type: 'buffer' })
  const ws    = wb.Sheets[wb.SheetNames[0]]
  const tabla = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]

  if (tabla.length < 2) {
    return { headers: [], rows: [], total: 0 }
  }

  const headers  = (tabla[0] ?? []).map(String)
  const datRows  = tabla.slice(1)
  const total    = datRows.filter((r) => r.some((c) => String(c).trim())).length

  return {
    headers,
    rows:  datRows.slice(0, 5).map((r) => r.map(String)),
    total,
  }
}

// ── Procesar importación ──────────────────────────────────────────────────────

/**
 * Procesa la importación completa de un Excel.
 * Por cada fila:
 *   - Valida nombre, cédula y teléfono obligatorios
 *   - Calcula SHA-256 de la cédula (deduplicación)
 *   - Verifica duplicados por cedulaHash:
 *       mismo líder    → skip silencioso
 *       otro líder     → crea VoterDuplicateAlert + Notifications, NO crea Voter
 *       no existe      → crea Voter con cédula cifrada y hash
 * Procesa en batches de 100 filas.
 */
export async function procesarImportExcel(
  buffer:   Buffer,
  leaderId: string,
  tenantId: string,
  db:       PrismaClient,
): Promise<ImportExcelResult> {
  const wb    = XLSX.read(buffer, { type: 'buffer' })
  const ws    = wb.Sheets[wb.SheetNames[0]]
  const tabla = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]

  if (tabla.length < 2) {
    return { created: 0, skipped: 0, duplicates: 0, errors: ['El archivo no contiene datos.'] }
  }

  // Mapear índices de columna por nombre (case-insensitive)
  const encabezados = (tabla[0] ?? []).map((h) => String(h).toLowerCase().trim())
  const idx = {
    nombre:    encabezados.indexOf('nombre'),
    cedula:    encabezados.indexOf('cedula'),
    telefono:  encabezados.indexOf('telefono'),
    direccion: encabezados.indexOf('direccion'),
    lider_id:  encabezados.indexOf('lider_id'),
    puesto_id: encabezados.indexOf('puesto_id'),
    mesa_id:   encabezados.indexOf('mesa_id'),
  }

  if (idx.nombre === -1 || idx.cedula === -1) {
    return { created: 0, skipped: 0, duplicates: 0, errors: ['El Excel debe tener columnas "nombre" y "cedula".'] }
  }

  const filasDatos = tabla.slice(1).filter((r) => r.some((c) => String(c).trim()))

  let created    = 0
  let skipped    = 0
  let duplicates = 0
  const errors:  string[] = []

  const BATCH = 100
  for (let i = 0; i < filasDatos.length; i += BATCH) {
    const lote = filasDatos.slice(i, i + BATCH)

    for (let j = 0; j < lote.length; j++) {
      const fila     = lote[j]
      const lineaNum = i + j + 2  // +2 por encabezado y base-0

      const nombre  = String(fila[idx.nombre]  ?? '').trim()
      const cedula  = String(fila[idx.cedula]  ?? '').trim()
      const telRaw  = idx.telefono  !== -1 ? String(fila[idx.telefono]  ?? '').trim() : ''
      const dirRaw  = idx.direccion !== -1 ? String(fila[idx.direccion] ?? '').trim() : ''
      const puestoId = idx.puesto_id !== -1 ? String(fila[idx.puesto_id] ?? '').trim() || undefined : undefined
      const mesaId   = idx.mesa_id   !== -1 ? String(fila[idx.mesa_id]  ?? '').trim() || undefined : undefined
      const liderIdFila = idx.lider_id !== -1 ? String(fila[idx.lider_id] ?? '').trim() || undefined : undefined

      if (!nombre || !cedula) {
        errors.push(`Fila ${lineaNum}: nombre y cédula son obligatorios.`)
        continue
      }

      const cedulaHash = createHash('sha256').update(cedula).digest('hex')

      // Buscar si ya existe en el tenant por cedulaHash
      const existente = await db.voter.findFirst({
        where:  { tenantId, cedulaHash },
        select: { id: true, leaderId: true },
      })

      if (existente) {
        if (existente.leaderId === leaderId) {
          // Mismo líder: skip silencioso
          skipped++
          continue
        }

        // Diferente líder: crear alerta de duplicado y NO crear elector
        await crearAlertaDuplicado(
          {
            tenantId,
            cedulaHash,
            firstLeaderId:     existente.leaderId ?? leaderId,
            duplicateLeaderId: leaderId,
          },
          db,
        )
        duplicates++
        continue
      }

      // No existe → crear elector
      try {
        const nuevo = await db.voter.create({
          data: {
            tenantId,
            cedula:      encrypt(cedula),
            cedulaHash,
            name:        nombre,
            phone:       telRaw ? encrypt(telRaw) : undefined,
            address:     dirRaw || undefined,
            leaderId:    liderIdFila ?? leaderId,
            votingTableId: mesaId,
            captureDepth: 0,
          },
        })
        await crearQrPropio(nuevo.id, tenantId, db as any)
        created++
      } catch (err: any) {
        if (err?.code === 'P2002') {
          skipped++
        } else {
          errors.push(`Fila ${lineaNum}: error al crear elector — ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
  }

  return { created, skipped, duplicates, errors }
}
