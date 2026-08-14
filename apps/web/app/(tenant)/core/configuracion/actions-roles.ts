'use server'

/**
 * Server Actions de "Roles y permisos" + "Usuarios" — solo ADMIN_CAMPANA.
 * CustomRole/CustomRolePermission/User viven en la DB del superadmin (igual
 * que Tenant/TenantModule) — se resuelven una vez por login, no en cada request.
 */

import { requireAuth } from '@/lib/auth-helpers'
import { superadminDb, getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { type UserRole } from '@vectra/auth'
import { SCREENS } from '@/lib/screens'

/** ELECTOR nunca tiene fila en User (solo de sesión) — un staff no puede tener ese rol. */
export type StaffRole = Exclude<UserRole, 'ELECTOR'>

// ── Roles personalizados ────────────────────────────────────────────────────

export interface CustomRoleView {
  id:          string
  name:        string
  permissions: Record<string, { canView: boolean; canEdit: boolean }>
  totalUsuarios: number
}

export async function listarRoles(): Promise<CustomRoleView[]> {
  const session = await requireAuth(['ADMIN_CAMPANA'])

  const roles = await superadminDb.customRole.findMany({
    where:   { tenantId: session.user.tenantId },
    include: { permissions: true, _count: { select: { users: true } } },
    orderBy: { name: 'asc' },
  })

  return roles.map((r) => ({
    id: r.id, name: r.name, totalUsuarios: r._count.users,
    permissions: Object.fromEntries(r.permissions.map((p) => [p.screenKey, { canView: p.canView, canEdit: p.canEdit }])),
  }))
}

export interface PermisoInput { screenKey: string; canView: boolean; canEdit: boolean }

/** Crea un rol con su matriz de permisos inicial (puede venir vacía). */
export async function crearRol(name: string, permisos: PermisoInput[]) {
  const session = await requireAuth(['ADMIN_CAMPANA'])
  if (!name.trim()) return { success: false, error: 'Falta el nombre del rol.' }

  const invalidos = permisos.filter((p) => !SCREENS[p.screenKey])
  if (invalidos.length > 0) return { success: false, error: 'Pantalla inválida.' }

  try {
    await superadminDb.customRole.create({
      data: {
        tenantId: session.user.tenantId, name: name.trim(),
        permissions: { create: permisos.filter((p) => p.canView || p.canEdit).map((p) => ({
          screenKey: p.screenKey, canView: p.canView, canEdit: p.canEdit,
        })) },
      },
    })
  } catch {
    return { success: false, error: 'Ya existe un rol con ese nombre.' }
  }

  revalidatePath('/core/configuracion')
  return { success: true }
}

/** Reemplaza la matriz de permisos completa de un rol existente. */
export async function actualizarPermisosRol(roleId: string, permisos: PermisoInput[]) {
  const session = await requireAuth(['ADMIN_CAMPANA'])

  const rol = await superadminDb.customRole.findFirst({ where: { id: roleId, tenantId: session.user.tenantId } })
  if (!rol) return { success: false, error: 'Rol no encontrado.' }

  await superadminDb.$transaction([
    superadminDb.customRolePermission.deleteMany({ where: { roleId } }),
    superadminDb.customRolePermission.createMany({
      data: permisos.filter((p) => p.canView || p.canEdit).map((p) => ({
        roleId, screenKey: p.screenKey, canView: p.canView, canEdit: p.canEdit,
      })),
    }),
  ])

  revalidatePath('/core/configuracion')
  return { success: true }
}

export async function eliminarRol(roleId: string) {
  const session = await requireAuth(['ADMIN_CAMPANA'])

  const rol = await superadminDb.customRole.findFirst({
    where: { id: roleId, tenantId: session.user.tenantId },
    include: { _count: { select: { users: true } } },
  })
  if (!rol) return { success: false, error: 'Rol no encontrado.' }
  if (rol._count.users > 0) return { success: false, error: 'Hay usuarios con este rol — reasígnalos primero.' }

  await superadminDb.customRole.delete({ where: { id: roleId } })
  revalidatePath('/core/configuracion')
  return { success: true }
}

// ── Usuarios de staff ───────────────────────────────────────────────────────

export interface UsuarioView {
  id:       string
  name:     string | null
  email:    string
  role:     UserRole
  customRoleName: string | null
  voterId:  string | null
  isActive: boolean
}

export async function listarUsuarios(): Promise<UsuarioView[]> {
  const session = await requireAuth(['ADMIN_CAMPANA'])

  const usuarios = await superadminDb.user.findMany({
    where:   { tenantId: session.user.tenantId },
    include: { customRole: { select: { name: true } } },
    orderBy: { email: 'asc' },
  })

  return usuarios.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role as UserRole,
    customRoleName: u.customRole?.name ?? null, voterId: u.voterId, isActive: u.isActive,
  }))
}

/**
 * Todo testigo es un elector de la campaña. La Registraduría lo identifica por
 * la CÉDULA, que vive cifrada en su ficha de `Voter` — el `User` está en la BD
 * del superadmin y no la tiene. Un testigo sin elector no se puede radicar, y
 * hoy eso solo se descubría al armar el listado, cuando ya no hay margen.
 */
const TESTIGO_NECESITA_ELECTOR =
  'Un testigo tiene que estar vinculado a un elector: de ahí sale la cédula que pide la Registraduría.'

export interface CrearUsuarioInput {
  name:     string
  email:    string
  password: string
  role:     StaffRole
  customRoleId?: string
  voterId?:      string
}

export async function crearUsuario(input: CrearUsuarioInput) {
  const session = await requireAuth(['ADMIN_CAMPANA'])

  if (!input.name.trim())  return { success: false, error: 'Falta el nombre.' }
  if (!input.email.trim()) return { success: false, error: 'Falta el correo.' }
  if (input.password.length < 8) return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' }
  if (input.role === 'PERSONALIZADO' && !input.customRoleId) {
    return { success: false, error: 'Elige un rol personalizado.' }
  }
  if (input.role === 'TESTIGO' && !input.voterId) {
    return { success: false, error: TESTIGO_NECESITA_ELECTOR }
  }
  if (input.role === 'SUPERADMIN') return { success: false, error: 'No puedes crear cuentas SUPERADMIN desde aquí.' }

  const passwordHash = await bcrypt.hash(input.password, 12)

  try {
    await superadminDb.user.create({
      data: {
        tenantId:     session.user.tenantId,
        name:         input.name.trim(),
        email:        input.email.trim().toLowerCase(),
        passwordHash,
        role:         input.role,
        customRoleId: input.role === 'PERSONALIZADO' ? input.customRoleId : null,
        voterId:      input.voterId || null,
        isActive:     true,
      },
    })
  } catch {
    return { success: false, error: 'Ya existe una cuenta con ese correo.' }
  }

  revalidatePath('/core/configuracion')
  return { success: true }
}

/**
 * Vincula (o desvincula, con null) un usuario del panel a su elector.
 *
 * Quien administra la campaña también es una persona de la campaña: sin este
 * vínculo no aparece en los desplegables de líder ni puede usar el PWA. Las
 * campañas nuevas ya nacen con el admin vinculado (ver superadmin/actions.ts);
 * esto es para los usuarios que se crearon antes o sin elegir elector.
 */
export async function vincularUsuarioAElector(userId: string, voterId: string | null) {
  const session  = await requireAuth(['ADMIN_CAMPANA'])
  const tenantId = session.user.tenantId

  const usuario = await superadminDb.user.findFirst({ where: { id: userId, tenantId }, select: { id: true, role: true } })
  if (!usuario) return { success: false, error: 'Usuario no encontrado.' }

  // Desvincular a un testigo lo deja sin cédula y por fuera del trámite.
  if (!voterId && usuario.role === 'TESTIGO') {
    return { success: false, error: TESTIGO_NECESITA_ELECTOR }
  }

  if (voterId) {
    const db = getTenantDb(await getTenantConnection(tenantId))
    const elector = await db.voter.findFirst({ where: { id: voterId, tenantId }, select: { id: true } })
    if (!elector) return { success: false, error: 'Ese elector no existe en esta campaña.' }

    // Un elector no puede ser dos usuarios: si no, dos cuentas escribirían el
    // mismo perfil y responderían por las mismas actividades.
    const ocupado = await superadminDb.user.findFirst({
      where:  { tenantId, voterId, id: { not: userId } },
      select: { email: true },
    })
    if (ocupado) return { success: false, error: `Ese elector ya está vinculado a ${ocupado.email}.` }
  }

  await superadminDb.user.update({ where: { id: userId }, data: { voterId } })
  revalidatePath('/core/configuracion')
  return { success: true }
}

/** Activa/desactiva una cuenta de staff (no borra — mismo criterio que Tenant.isActive). */
export async function alternarUsuarioActivo(id: string, isActive: boolean) {
  const session = await requireAuth(['ADMIN_CAMPANA'])

  const usuario = await superadminDb.user.findFirst({ where: { id, tenantId: session.user.tenantId } })
  if (!usuario) return { success: false, error: 'Usuario no encontrado.' }
  if (usuario.role === 'ADMIN_CAMPANA' && !isActive) {
    const otrosAdmins = await superadminDb.user.count({
      where: { tenantId: session.user.tenantId, role: 'ADMIN_CAMPANA', isActive: true, id: { not: id } },
    })
    if (otrosAdmins === 0) return { success: false, error: 'No puedes desactivar al único administrador.' }
  }

  await superadminDb.user.update({ where: { id }, data: { isActive } })
  revalidatePath('/core/configuracion')
  return { success: true }
}
