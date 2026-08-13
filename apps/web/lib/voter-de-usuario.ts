/**
 * El elector que hay detrás de un usuario del panel.
 *
 * Regla: quien administra la campaña también es una persona de la campaña — sin
 * su `Voter` no aparece en los desplegables de líder (sede, comuna, barrio) ni
 * puede usar el PWA. Por eso el admin nace con elector cuando nace el tenant.
 *
 * Busca por cédula ANTES de crear: si esa persona ya está en el padrón, se
 * vincula a la que existe en vez de duplicarla. Eso hace que dé lo mismo si el
 * admin se crea antes o después de importar el padrón.
 */

import { encrypt, type getTenantDb } from '@vectra/db'
import { calcularCedulaHash } from './cedula-hash'
import { crearQrPropio } from './qr'

type Db = ReturnType<typeof getTenantDb>

export type ResultadoVoterUsuario =
  | { success: true; voterId: string; yaExistia: boolean }
  | { success: false; error: string }

export async function obtenerOCrearVoterDeUsuario(
  db: Db,
  tenantId: string,
  datos: { name: string; cedula: string },
): Promise<ResultadoVoterUsuario> {
  const nombre = datos.name.trim()
  const cedula = datos.cedula.trim()
  if (!nombre) return { success: false, error: 'Falta el nombre.' }
  if (!/^\d{5,15}$/.test(cedula)) return { success: false, error: 'La cédula debe ser un número de 5 a 15 dígitos.' }

  const cedulaHash = calcularCedulaHash(cedula)

  const existente = await db.voter.findFirst({ where: { tenantId, cedulaHash }, select: { id: true } })
  if (existente) return { success: true, voterId: existente.id, yaExistia: true }

  const voter = await db.voter.create({
    data: { tenantId, name: nombre, cedula: encrypt(cedula), cedulaHash },
  })
  // Mismo trato que cualquier alta de elector: su QR de captación propio.
  await crearQrPropio(voter.id, tenantId, db)

  return { success: true, voterId: voter.id, yaExistia: false }
}
