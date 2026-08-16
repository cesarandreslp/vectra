/**
 * Carga masiva del equipo: coordinadores y líderes. Cada uno es una cuenta
 * (correo + contraseña) con su rol. El LÍDER además es un elector con su zona y
 * su meta de votos, así que si trae cédula se le crea/enlaza la ficha.
 *
 * Solo COORDINADOR y LIDER — no se crean admins por carga masiva (seguridad).
 * La contraseña inicial por defecto es la cédula; si no hay cédula, hay que
 * ponerla en la columna `password`. Debe cambiarse en el primer ingreso.
 * xlsx solo en el servidor.
 */

import { createHash } from 'crypto'
import * as XLSX from 'xlsx'
import bcrypt from 'bcryptjs'
import { encrypt, superadminDb } from '@vectra/db'
import type { PrismaClient } from '@vectra/db'
import { crearQrPropio } from '@/lib/qr'

export interface ImportStaffResult {
  created: number
  skipped: number
  errors:  string[]
}

const COLUMNAS = ['nombre', 'email', 'rol', 'cedula', 'telefono', 'zona', 'meta_votos', 'password']
const ROLES_OK = new Set(['COORDINADOR', 'LIDER'])

export function generarPlantillaStaff(): Buffer {
  const wb = XLSX.utils.book_new()
  const datos = [
    COLUMNAS,
    ['Laura Méndez', 'laura@campaña.co', 'COORDINADOR', '', '3001112233', 'Comuna 3', '', ''],
    ['Pedro Ruiz', 'pedro@campaña.co', 'LIDER', '79123456', '3004445566', 'Barrio Centro', '150', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(datos)
  ws['!cols'] = COLUMNAS.map(() => ({ wch: 20 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Equipo')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

export async function procesarImportStaff(
  buffer:   Buffer,
  tenantId: string,
  db:       PrismaClient,
): Promise<ImportStaffResult> {
  const wb    = XLSX.read(buffer, { type: 'buffer' })
  const ws    = wb.Sheets[wb.SheetNames[0]]
  const tabla = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]
  if (tabla.length < 2) return { created: 0, skipped: 0, errors: ['El archivo no contiene datos.'] }

  const enc = (tabla[0] ?? []).map((h) => String(h).toLowerCase().trim())
  const idx = {
    nombre: enc.indexOf('nombre'), email: enc.indexOf('email'), rol: enc.indexOf('rol'),
    cedula: enc.indexOf('cedula'), telefono: enc.indexOf('telefono'),
    zona: enc.indexOf('zona'), meta: enc.indexOf('meta_votos'), password: enc.indexOf('password'),
  }
  if (idx.nombre === -1 || idx.email === -1 || idx.rol === -1) {
    return { created: 0, skipped: 0, errors: ['El Excel debe tener columnas "nombre", "email" y "rol".'] }
  }

  const candidato = await db.voter.findFirst({ where: { tenantId, isCandidate: true }, select: { id: true } })

  const filas = tabla.slice(1).filter((r) => r.some((c) => String(c).trim()))
  let created = 0, skipped = 0
  const errors: string[] = []

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]
    const linea = i + 2
    const nombre = String(fila[idx.nombre] ?? '').trim()
    const email  = String(fila[idx.email] ?? '').trim().toLowerCase()
    const rol    = String(fila[idx.rol] ?? '').trim().toUpperCase()
    const cedula = idx.cedula !== -1 ? String(fila[idx.cedula] ?? '').trim() : ''
    const telefono = idx.telefono !== -1 ? String(fila[idx.telefono] ?? '').trim() : ''
    const zona   = idx.zona !== -1 ? String(fila[idx.zona] ?? '').trim() : ''
    const meta   = idx.meta !== -1 ? (parseInt(String(fila[idx.meta] ?? '')) || 0) : 0
    const passIn = idx.password !== -1 ? String(fila[idx.password] ?? '').trim() : ''

    if (!nombre || !email) { errors.push(`Fila ${linea}: nombre y email son obligatorios.`); continue }
    if (!ROLES_OK.has(rol)) { errors.push(`Fila ${linea}: rol inválido ("${rol}"). Solo COORDINADOR o LIDER.`); continue }
    if (rol === 'LIDER' && !cedula) { errors.push(`Fila ${linea}: un líder necesita cédula (es también elector).`); continue }

    const password = passIn || cedula
    if (password.length < 8) { errors.push(`Fila ${linea}: falta contraseña (o la cédula tiene menos de 8 dígitos). Usa la columna password.`); continue }

    try {
      // Líder: crear/enlazar su ficha de elector con zona y meta.
      let voterId: string | null = null
      if (rol === 'LIDER') {
        const cedulaHash = createHash('sha256').update(cedula).digest('hex')
        const existente = await db.voter.findFirst({ where: { tenantId, cedulaHash }, select: { id: true } })
        if (existente) {
          await db.voter.update({ where: { id: existente.id }, data: { zone: zona || undefined, targetVotes: meta, status: 'ACTIVO' } })
          voterId = existente.id
        } else {
          const nuevo = await db.voter.create({
            data: {
              tenantId, cedula: encrypt(cedula), cedulaHash, name: nombre,
              phone: telefono ? encrypt(telefono) : undefined,
              zone: zona || undefined, targetVotes: meta, status: 'ACTIVO', leaderId: candidato?.id,
            },
            select: { id: true },
          })
          await crearQrPropio(nuevo.id, tenantId, db)
          voterId = nuevo.id
        }
        // Un elector no puede ser dos cuentas.
        const ocupado = await superadminDb.user.findFirst({ where: { tenantId, voterId }, select: { id: true } })
        if (ocupado) { skipped++; continue }
      }

      await superadminDb.user.create({
        data: { tenantId, name: nombre, email, passwordHash: await bcrypt.hash(password, 12), role: rol as 'COORDINADOR' | 'LIDER', voterId, isActive: true },
      })
      created++
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'P2002') { errors.push(`Fila ${linea}: ${email} ya tiene cuenta (correo o cédula repetida).`); skipped++ }
      else errors.push(`Fila ${linea}: error — ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { created, skipped, errors }
}
