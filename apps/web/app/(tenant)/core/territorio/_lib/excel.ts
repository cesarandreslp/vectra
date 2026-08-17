/**
 * Plantilla y procesamiento del Excel de territorio (comunas/zonas, barrios,
 * puestos de votación y mesas) — para municipios sin datos DIVIPOLA a nivel
 * de comuna/puesto. Buga se sembró a mano desde fuentes oficiales; cualquier
 * otra campaña carga su propio territorio así.
 *
 * 4 hojas, procesadas en orden porque cada una puede referenciar la anterior
 * por nombre: Comunas → Barrios → Puestos → Mesas. Cada hoja es opcional y
 * cada fila es idempotente (ya existe → se salta), así que el mismo archivo
 * puede recargarse o subirse por partes sin duplicar nada.
 */

import * as XLSX from 'xlsx'
import type { PrismaClient } from '@vectra/db'

export interface ImportTerritorioResult {
  zonas:   { created: number }
  comunas: { created: number; skipped: number }
  barrios: { created: number; skipped: number }
  puestos: { created: number; skipped: number }
  mesas:   { created: number; skipped: number }
  errors:  string[]
}

const HOJAS = {
  comunas: { nombre: 'Comunas', columnas: ['nombre', 'tipo'] },
  barrios: { nombre: 'Barrios', columnas: ['nombre', 'comuna'] },
  // `zona` es la zona electoral de la Registraduría (parte del identificador del
  // E-14: depto+municipio+zona+puesto+mesa). Obligatoria para un puesto nuevo.
  puestos: { nombre: 'Puestos', columnas: ['nombre', 'zona', 'direccion', 'lat', 'lng', 'especial'] },
  mesas:   { nombre: 'Mesas',   columnas: ['puesto', 'numero', 'capacidad'] },
} as const

export function generarPlantillaTerritorioExcel(): Buffer {
  const wb = XLSX.utils.book_new()

  const hojas: [string, string[][]][] = [
    [HOJAS.comunas.nombre, [
      [...HOJAS.comunas.columnas],
      ['Comuna 1', 'COMUNA'],
      ['El Placer', 'CORREGIMIENTO'],
    ]],
    [HOJAS.barrios.nombre, [
      [...HOJAS.barrios.columnas],
      ['Centro', 'Comuna 1'],
    ]],
    [HOJAS.puestos.nombre, [
      [...HOJAS.puestos.columnas],
      ['Institución Educativa San José', '01', 'Cra 10 # 5-20', '3.9021', '-76.2987', ''],
    ]],
    [HOJAS.mesas.nombre, [
      [...HOJAS.mesas.columnas],
      ['Institución Educativa San José', '1', '350'],
    ]],
  ]

  for (const [nombreHoja, datos] of hojas) {
    const ws = XLSX.utils.aoa_to_sheet(datos)
    ws['!cols'] = datos[0].map(() => ({ wch: 26 }))
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja)
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(buffer)
}

function leerHoja(wb: XLSX.WorkBook, nombreHoja: string): Record<string, string>[] {
  const ws = wb.Sheets[nombreHoja]
  if (!ws) return []
  const tabla = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]
  if (tabla.length < 2) return []
  const encabezados = (tabla[0] ?? []).map((h) => String(h).toLowerCase().trim())
  return tabla.slice(1)
    .filter((r) => r.some((c) => String(c).trim()))
    .map((r) => {
      const fila: Record<string, string> = {}
      encabezados.forEach((h, i) => { fila[h] = String(r[i] ?? '').trim() })
      return fila
    })
}

export async function procesarImportTerritorioExcel(
  buffer: Buffer,
  municipalityId: string,
  db: PrismaClient,
): Promise<ImportTerritorioResult> {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const resultado: ImportTerritorioResult = {
    zonas:   { created: 0 },
    comunas: { created: 0, skipped: 0 },
    barrios: { created: 0, skipped: 0 },
    puestos: { created: 0, skipped: 0 },
    mesas:   { created: 0, skipped: 0 },
    errors:  [],
  }

  // 1. Comunas / zonas
  for (const fila of leerHoja(wb, HOJAS.comunas.nombre)) {
    const nombre = fila.nombre
    if (!nombre) continue
    const tipo: 'COMUNA' | 'CORREGIMIENTO' = fila.tipo?.toUpperCase() === 'CORREGIMIENTO' ? 'CORREGIMIENTO' : 'COMUNA'
    const existe = await db.commune.findFirst({
      where: { municipalityId, name: { equals: nombre, mode: 'insensitive' } },
    })
    if (existe) { resultado.comunas.skipped++; continue }
    await db.commune.create({ data: { name: nombre, type: tipo, municipalityId } })
    resultado.comunas.created++
  }

  // 2. Barrios — requieren la comuna ya creada (en este archivo o antes)
  const comunasDb = await db.commune.findMany({ where: { municipalityId } })
  for (const fila of leerHoja(wb, HOJAS.barrios.nombre)) {
    const nombre = fila.nombre
    const nombreComuna = fila.comuna
    if (!nombre) continue
    if (!nombreComuna) { resultado.errors.push(`Barrio "${nombre}": falta la columna "comuna".`); continue }
    const comuna = comunasDb.find((c) => c.name.toLowerCase() === nombreComuna.toLowerCase())
    if (!comuna) { resultado.errors.push(`Barrio "${nombre}": no existe la comuna/corregimiento "${nombreComuna}".`); continue }
    const existe = await db.neighborhood.findFirst({
      where: { communeId: comuna.id, name: { equals: nombre, mode: 'insensitive' } },
    })
    if (existe) { resultado.barrios.skipped++; continue }
    await db.neighborhood.create({ data: { name: nombre, communeId: comuna.id } })
    resultado.barrios.created++
  }

  // 3. Puestos de votación — con su ZONA electoral (parte del ID del E-14).
  const zonasCache = new Map<string, string>()
  for (const z of await db.zona.findMany({ where: { municipalityId }, select: { id: true, code: true } })) {
    zonasCache.set(z.code.toLowerCase(), z.id)
  }
  for (const fila of leerHoja(wb, HOJAS.puestos.nombre)) {
    const nombre = fila.nombre
    if (!nombre) continue
    const direccion = fila.direccion
    if (!direccion) { resultado.errors.push(`Puesto "${nombre}": falta la dirección.`); continue }
    const existe = await db.votingStation.findFirst({
      where: { municipalityId, name: { equals: nombre, mode: 'insensitive' } },
    })
    if (existe) { resultado.puestos.skipped++; continue }

    const zonaCode = fila.zona
    if (!zonaCode) { resultado.errors.push(`Puesto "${nombre}": falta la zona (es parte del identificador del E-14).`); continue }
    // La zona se crea sola la primera vez que aparece en el municipio.
    let zonaId = zonasCache.get(zonaCode.toLowerCase())
    if (!zonaId) {
      const z = await db.zona.create({ data: { municipalityId, code: zonaCode } })
      zonaId = z.id
      zonasCache.set(zonaCode.toLowerCase(), zonaId)
      resultado.zonas.created++
    }

    const lat = Number(fila.lat)
    const lng = Number(fila.lng)
    await db.votingStation.create({
      data: {
        name: nombre, address: direccion, municipalityId, zonaId,
        lat: fila.lat && Number.isFinite(lat) ? lat : undefined,
        lng: fila.lng && Number.isFinite(lng) ? lng : undefined,
        specialLabel: fila.especial || undefined,
      },
    })
    resultado.puestos.created++
  }

  // 4. Mesas — requieren el puesto ya creado (en este archivo o antes)
  const puestosDb = await db.votingStation.findMany({ where: { municipalityId } })
  for (const fila of leerHoja(wb, HOJAS.mesas.nombre)) {
    const nombrePuesto = fila.puesto
    const numero = parseInt(fila.numero, 10)
    if (!nombrePuesto || !Number.isFinite(numero)) continue
    const puesto = puestosDb.find((p) => p.name.toLowerCase() === nombrePuesto.toLowerCase())
    if (!puesto) { resultado.errors.push(`Mesa ${fila.numero} de "${nombrePuesto}": no existe ese puesto de votación.`); continue }
    const existe = await db.votingTable.findFirst({ where: { stationId: puesto.id, number: numero } })
    if (existe) { resultado.mesas.skipped++; continue }
    const capacidad = parseInt(fila.capacidad, 10)
    await db.votingTable.create({
      data: { stationId: puesto.id, number: numero, voterCapacity: Number.isFinite(capacidad) ? capacidad : 0 },
    })
    resultado.mesas.created++
  }

  return resultado
}
