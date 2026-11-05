'use server'

/**
 * Cuentas de la plataforma (las que entran por /superadmin/login): SUPERADMIN y
 * OPERADOR. Solo un SUPERADMIN las maneja. Máximo MAX_SUPERADMINS superadmins
 * ACTIVOS a la vez: desactivar uno libera el cupo.
 */

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { superadminDb } from '@vectra/db'
import { SUPERADMIN_TENANT_ID } from '@vectra/auth'
import { requireAuth } from '@/lib/auth-helpers'
import { registrarEvento } from '@/lib/bitacora'

const MAX_SUPERADMINS = 2
type RolPlataforma = 'SUPERADMIN' | 'OPERADOR'
type Resultado = { success: true } | { success: false; error: string }

export interface UsuarioPlataforma {
  id: string; name: string | null; email: string; role: RolPlataforma
  isActive: boolean; dobleFactor: boolean; esYo: boolean
}

// ponytail: contar y luego crear no es atómico; dos superadmins creando a la vez
// podrían pasar el tope. Con 2 personas en el panel no vale un lock.
async function cupoSuperadmin(): Promise<boolean> {
  const activos = await superadminDb.user.count({ where: { tenantId: SUPERADMIN_TENANT_ID, role: 'SUPERADMIN', isActive: true } })
  return activos < MAX_SUPERADMINS
}

export async function listUsuariosPlataforma(): Promise<UsuarioPlataforma[]> {
  const session = await requireAuth(['SUPERADMIN'])
  const users = await superadminDb.user.findMany({
    where: { tenantId: SUPERADMIN_TENANT_ID },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, email: true, role: true, isActive: true, totpActivadoEn: true },
  })
  return users.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role as RolPlataforma,
    isActive: u.isActive, dobleFactor: Boolean(u.totpActivadoEn), esYo: u.id === session.user.userId,
  }))
}

export async function crearUsuarioPlataforma(input: { name: string; email: string; password: string; role: RolPlataforma }): Promise<Resultado> {
  const session = await requireAuth(['SUPERADMIN'])
  const email = String(input.email ?? '').trim()
  if (input.role !== 'SUPERADMIN' && input.role !== 'OPERADOR') return { success: false, error: 'Rol no válido.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: 'El correo no es válido.' }
  if (String(input.password ?? '').length < 12) return { success: false, error: 'La contraseña debe tener al menos 12 caracteres.' }
  if (input.role === 'SUPERADMIN' && !(await cupoSuperadmin())) {
    return { success: false, error: `Ya hay ${MAX_SUPERADMINS} superadmins activos. Desactiva uno o crea la cuenta como operador.` }
  }
  if (await superadminDb.user.findUnique({ where: { email }, select: { id: true } })) {
    return { success: false, error: 'Ya existe una cuenta con ese correo en la plataforma.' }
  }
  await superadminDb.user.create({
    data: { tenantId: SUPERADMIN_TENANT_ID, name: input.name?.trim() || null, email, role: input.role, isActive: true, passwordHash: await bcrypt.hash(input.password, 12) },
  })
  await registrarEvento(session, 'CREAR_USUARIO_PLATAFORMA', input.role, email)
  revalidatePath('/superadmin/usuarios')
  return { success: true }
}

export async function cambiarEstadoUsuarioPlataforma(userId: string, activo: boolean): Promise<Resultado> {
  const session = await requireAuth(['SUPERADMIN'])
  if (userId === session.user.userId) return { success: false, error: 'No puedes desactivar tu propia cuenta.' }
  const u = await superadminDb.user.findFirst({ where: { id: userId, tenantId: SUPERADMIN_TENANT_ID }, select: { id: true, email: true, role: true } })
  if (!u) return { success: false, error: 'Cuenta no encontrada.' }
  if (activo && u.role === 'SUPERADMIN' && !(await cupoSuperadmin())) {
    return { success: false, error: `Ya hay ${MAX_SUPERADMINS} superadmins activos.` }
  }
  // Al desactivar, la sesión abierta se corta sola en máx. 5 min (sesionVigente en @vectra/auth).
  await superadminDb.user.update({ where: { id: u.id }, data: { isActive: activo } })
  await registrarEvento(session, activo ? 'ACTIVAR_USUARIO_PLATAFORMA' : 'DESACTIVAR_USUARIO_PLATAFORMA', u.role, u.email)
  revalidatePath('/superadmin/usuarios')
  return { success: true }
}
