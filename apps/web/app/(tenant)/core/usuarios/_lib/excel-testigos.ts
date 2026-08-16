/**
 * Carga masiva de testigos por Excel. Cada testigo es un elector (cédula) con
 * rol TESTIGO y, opcionalmente, una mesa asignada. Su credencial de acceso es
 * cédula + fecha de nacimiento, así que la fecha es OBLIGATORIA y debe ser 18+.
 *
 * Reusa el patrón del import de electores. xlsx solo en el servidor.
 */

import { createHash, randomBytes } from 'crypto'
import * as XLSX from 'xlsx'
import bcrypt from 'bcryptjs'
import { encrypt, superadminDb } from '@vectra/db'
import type { PrismaClient } from '@vectra/db'
import { esMayorDeEdad } from '@/lib/edad'
import { crearQrPropio } from '@/lib/qr'
import { parsearFechaNacimiento } from '../../importar/_lib/excel'

export interface ImportTestigosResult {
  created:  number
  skipped:  number
  errors:   string[]
}

const COLUMNAS = ['nombre', 'cedula', 'fecha_nacimiento', 'telefono', 'puesto', 'mesa', 'email']

/** Plantilla .xlsx con encabezados y una fila de ejemplo. */
export function generarPlantillaTestigos(): Buffer {
  const wb = XLSX.utils.book_new()
  const datos = [
    COLUMNAS,
    ['Ana María Restrepo', '31450022', '1988-04-12', '3001234567', 'Ie Academico', '21', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(datos)
  ws['!cols'] = COLUMNAS.map(() => ({ wch: 22 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Testigos')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

/**
 * Procesa el Excel: por cada fila crea (o reusa) el elector, lo hace TESTIGO y
 * le asigna la mesa (puesto + número). El login del testigo es cédula + fecha,
 * así que la cuenta lleva un hash aleatorio inservible como los sembrados.
 */
export async function procesarImportTestigos(
  buffer:   Buffer,
  tenantId: string,
  slug:     string,
  db:       PrismaClient,
): Promise<ImportTestigosResult> {
  const wb    = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws    = wb.Sheets[wb.SheetNames[0]]
  const tabla = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]
  if (tabla.length < 2) return { created: 0, skipped: 0, errors: ['El archivo no contiene datos.'] }

  const enc = (tabla[0] ?? []).map((h) => String(h).toLowerCase().trim())
  const idx = {
    nombre:  enc.indexOf('nombre'),
    cedula:  enc.indexOf('cedula'),
    fecha:   enc.indexOf('fecha_nacimiento'),
    telefono: enc.indexOf('telefono'),
    puesto:  enc.indexOf('puesto'),
    mesa:    enc.indexOf('mesa'),
    email:   enc.indexOf('email'),
  }
  if (idx.nombre === -1 || idx.cedula === -1 || idx.fecha === -1) {
    return { created: 0, skipped: 0, errors: ['El Excel debe tener columnas "nombre", "cedula" y "fecha_nacimiento".'] }
  }

  // Candidato: los testigos nuevos cuelgan de él. Y el mapa de mesas por
  // (puesto, número) para resolver la asignación, más las ya ocupadas.
  const [candidato, stations, asignadas] = await Promise.all([
    db.voter.findFirst({ where: { tenantId, isCandidate: true }, select: { id: true } }),
    db.votingStation.findMany({ select: { name: true, tables: { select: { id: true, number: true } } } }),
    db.witnessAssignment.findMany({ where: { tenantId }, select: { votingTableId: true } }),
  ])
  const mesaPorClave = new Map<string, string>()
  for (const s of stations) for (const m of s.tables) mesaPorClave.set(`${s.name.toLowerCase().trim()}|${m.number}`, m.id)
  const ocupadas = new Set(asignadas.map((a) => a.votingTableId))

  const hashInservible = await bcrypt.hash(randomBytes(32).toString('hex'), 12)
  const filas = tabla.slice(1).filter((r) => r.some((c) => String(c).trim()))

  let created = 0, skipped = 0
  const errors: string[] = []

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]
    const linea = i + 2
    const nombre = String(fila[idx.nombre] ?? '').trim()
    const cedula = String(fila[idx.cedula] ?? '').trim()
    const fecha  = parsearFechaNacimiento(fila[idx.fecha])
    const telefono = idx.telefono !== -1 ? String(fila[idx.telefono] ?? '').trim() : ''
    const puesto = idx.puesto !== -1 ? String(fila[idx.puesto] ?? '').trim() : ''
    const mesaNum = idx.mesa !== -1 ? String(fila[idx.mesa] ?? '').trim() : ''
    const emailFila = idx.email !== -1 ? String(fila[idx.email] ?? '').trim().toLowerCase() : ''

    if (!nombre || !cedula) { errors.push(`Fila ${linea}: nombre y cédula son obligatorios.`); continue }
    if (!fecha) { errors.push(`Fila ${linea}: falta la fecha de nacimiento o no se entiende.`); continue }
    if (!esMayorDeEdad(fecha)) { errors.push(`Fila ${linea}: ${nombre} no es mayor de edad (18+), no puede ser testigo.`); continue }

    // Resolver la mesa si se indicó puesto + número.
    let votingTableId: string | undefined
    if (puesto && mesaNum) {
      votingTableId = mesaPorClave.get(`${puesto.toLowerCase()}|${mesaNum}`)
      if (!votingTableId) { errors.push(`Fila ${linea}: no existe la mesa ${mesaNum} en el puesto "${puesto}".`); continue }
      if (ocupadas.has(votingTableId)) { errors.push(`Fila ${linea}: la mesa ${mesaNum} de "${puesto}" ya tiene testigo.`); continue }
    }

    const cedulaHash = createHash('sha256').update(cedula).digest('hex')

    try {
      // Elector: reusar si ya existe, si no crearlo colgado del candidato.
      let voter = await db.voter.findFirst({ where: { tenantId, cedulaHash }, select: { id: true, birthDate: true } })
      if (voter) {
        // Ya es testigo? No se duplica.
        const yaTestigo = await superadminDb.user.findFirst({ where: { tenantId, voterId: voter.id, role: 'TESTIGO' }, select: { id: true } })
        if (yaTestigo) { skipped++; continue }
        if (!voter.birthDate) await db.voter.update({ where: { id: voter.id }, data: { birthDate: fecha } })
      } else {
        const creado = await db.voter.create({
          data: {
            tenantId, cedula: encrypt(cedula), cedulaHash, name: nombre,
            phone: telefono ? encrypt(telefono) : undefined,
            birthDate: fecha, leaderId: candidato?.id, commitmentStatus: 'VOTO_SEGURO',
          },
          select: { id: true },
        })
        await crearQrPropio(creado.id, tenantId, db)
        voter = { id: creado.id, birthDate: fecha }
      }

      // Cuenta TESTIGO. El correo no es el login (es cédula+fecha); si no lo dan,
      // se genera uno único por cédula+campaña para cumplir el unique.
      const email = emailFila || `t${cedula}@${slug || tenantId}.testigo.local`
      const usuario = await superadminDb.user.create({
        data: { tenantId, name: nombre, email, passwordHash: hashInservible, role: 'TESTIGO', voterId: voter.id, isActive: true },
        select: { id: true },
      })

      if (votingTableId) {
        await db.witnessAssignment.create({ data: { tenantId, userId: usuario.id, votingTableId, isPrimary: true } })
        ocupadas.add(votingTableId)
      }
      created++
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'P2002') { errors.push(`Fila ${linea}: ${nombre} ya tiene una cuenta (correo o cédula repetida).`); skipped++ }
      else errors.push(`Fila ${linea}: error al crear — ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { created, skipped, errors }
}
