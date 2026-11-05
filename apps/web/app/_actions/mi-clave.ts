'use server'

/** Cambio de contraseña de la propia cuenta (equipo de campaña y superadmin): pide la actual. */

import bcrypt from 'bcryptjs'
import { superadminDb } from '@vectra/db'
import { requireAuth } from '@/lib/auth-helpers'
import { registrarEvento } from '@/lib/bitacora'

type Resultado = { success: true } | { success: false; error: string }

export async function cambiarMiClave(actual: string, nueva: string): Promise<Resultado> {
  const session = await requireAuth(['SUPERADMIN', 'OPERADOR', 'ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'PERSONALIZADO'])
  if (String(nueva ?? '').length < 10) return { success: false, error: 'La contraseña nueva debe tener al menos 10 caracteres.' }
  if (nueva === actual) return { success: false, error: 'La contraseña nueva debe ser distinta de la actual.' }

  const u = await superadminDb.user.findUnique({ where: { id: session.user.userId }, select: { id: true, passwordHash: true } })
  if (!u?.passwordHash || !(await bcrypt.compare(String(actual ?? ''), u.passwordHash))) {
    return { success: false, error: 'La contraseña actual no es correcta.' }
  }
  await superadminDb.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(nueva, 12) } })
  await registrarEvento(session, 'CAMBIAR_CLAVE')
  return { success: true }
}
