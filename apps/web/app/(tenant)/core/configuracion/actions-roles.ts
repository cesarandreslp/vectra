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
import { esMayorDeEdad } from '@/lib/edad'
import { createVoter } from '../actions'
import { assignWitness } from '../../dia-e/actions'

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
 *
 * Pero "todo testigo es elector" NO significa que haya que escogerlo del padrón:
 * lo normal es que el testigo sea gente nueva, y al crearlo se le arma su ficha
 * de elector colgada del candidato. Escoger a alguien que YA está en el padrón
 * es el otro camino, no el principal.
 */
const TESTIGO_NECESITA_ELECTOR =
  'Un testigo tiene que quedar como elector: escribe su cédula, o escógelo del padrón si ya está.'

export interface CrearUsuarioInput {
  name:     string
  email:    string
  password: string
  role:     StaffRole
  customRoleId?: string
  /** Elector que YA existe en el padrón. Excluyente con `cedula`. */
  voterId?:      string
  /** Cédula para crearle la ficha de elector al testigo nuevo. */
  cedula?:       string
  phone?:        string
  /** Fecha de nacimiento (YYYY-MM-DD). Obligatoria para testigos: define si es
   *  apto (18+) y es parte de su credencial de acceso. */
  birthDate?:    string
  /** Mesa que va a vigilar. Se asigna al crearlo, no en una pantalla aparte. */
  votingTableId?: string
  /** Además, dejar esa mesa como su mesa de votación. Opcional a propósito. */
  tambienVotaAhi?: boolean
}

export async function crearUsuario(input: CrearUsuarioInput) {
  const session = await requireAuth(['ADMIN_CAMPANA'])

  const tenantId = session.user.tenantId

  if (!input.email.trim()) return { success: false, error: 'Falta el correo.' }
  if (input.password.length < 8) return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' }
  if (input.role === 'PERSONALIZADO' && !input.customRoleId) {
    return { success: false, error: 'Elige un rol personalizado.' }
  }
  if (input.role === 'SUPERADMIN') return { success: false, error: 'No puedes crear cuentas SUPERADMIN desde aquí.' }

  // La fecha se valida de formato acá; que sea OBLIGATORIA y 18+ depende del rol
  // (solo testigos), y eso se decide en cada rama de abajo.
  let birthDate: Date | undefined
  if (input.birthDate?.trim()) {
    const d = new Date(input.birthDate)
    if (isNaN(d.getTime())) return { success: false, error: 'La fecha de nacimiento no es válida.' }
    birthDate = d
  }

  let voterId = input.voterId || null
  let nombre  = input.name.trim()

  if (voterId) {
    // Viene del padrón: el nombre ya está en su ficha, no se vuelve a digitar.
    const db      = getTenantDb(await getTenantConnection(tenantId))
    const elector = await db.voter.findFirst({ where: { id: voterId, tenantId }, select: { name: true, birthDate: true } })
    if (!elector) return { success: false, error: 'Ese elector no existe en esta campaña.' }
    if (!nombre) nombre = elector.name

    // Un elector no puede ser dos cuentas: si no, ambas escribirían el mismo
    // perfil y responderían por las mismas actividades.
    const ocupado = await superadminDb.user.findFirst({
      where:  { tenantId, voterId },
      select: { email: true },
    })
    if (ocupado) return { success: false, error: `Ese elector ya está vinculado a ${ocupado.email}.` }

    // Testigo desde el padrón: exige fecha (la de su ficha, o una nueva si no la
    // tenía) y que sea mayor de edad. La fecha nueva se guarda en su ficha.
    if (input.role === 'TESTIGO') {
      const fecha = elector.birthDate ?? birthDate
      if (!fecha) return { success: false, error: 'Falta la fecha de nacimiento del testigo.' }
      if (!esMayorDeEdad(fecha)) return { success: false, error: 'El testigo debe ser mayor de edad (18+) para votar y vigilar una mesa.' }
      if (!elector.birthDate && birthDate) {
        await db.voter.update({ where: { id: voterId }, data: { birthDate } })
      }
    }

  } else if (input.role === 'TESTIGO') {
    // Testigo nuevo: se le crea la ficha de elector colgada del candidato. Va
    // ANTES de crear la cuenta — si la cédula está repetida, preferible no
    // dejar un User huérfano sin elector.
    if (!input.cedula?.trim()) return { success: false, error: TESTIGO_NECESITA_ELECTOR }
    if (!nombre) return { success: false, error: 'Falta el nombre.' }
    if (!birthDate) return { success: false, error: 'La fecha de nacimiento es obligatoria para un testigo.' }
    if (!esMayorDeEdad(birthDate)) return { success: false, error: 'El testigo debe ser mayor de edad (18+) para votar y vigilar una mesa.' }

    const db        = getTenantDb(await getTenantConnection(tenantId))
    const candidato = await db.voter.findFirst({
      where:  { tenantId, isCandidate: true },
      select: { id: true },
    })

    const creado = await createVoter({
      name:   nombre,
      cedula: input.cedula.trim(),
      phone:  input.phone?.trim() || undefined,
      birthDate,
      // Sin candidato marcado queda en la raíz del árbol, no bloquea.
      leaderId: candidato?.id,
    })
    if (!creado.success) return { success: false, error: creado.error }
    voterId = creado.voterId
  }

  if (!nombre) return { success: false, error: 'Falta el nombre.' }

  const passwordHash = await bcrypt.hash(input.password, 12)

  let usuarioId: string
  try {
    const creado = await superadminDb.user.create({
      data: {
        tenantId,
        name:         nombre,
        email:        input.email.trim().toLowerCase(),
        passwordHash,
        role:         input.role,
        customRoleId: input.role === 'PERSONALIZADO' ? input.customRoleId : null,
        voterId,
        isActive:     true,
      },
      select: { id: true },
    })
    usuarioId = creado.id
  } catch {
    return { success: false, error: 'Ya existe una cuenta con ese correo.' }
  }

  // La mesa va DESPUÉS de crear la cuenta porque assignWitness necesita el
  // userId. Si falla, la cuenta queda creada y sin mesa: se avisa y se asigna
  // de nuevo — mejor eso que perder el usuario recién creado.
  let aviso: string | undefined
  if (input.role === 'TESTIGO' && input.votingTableId) {
    const asignada = await assignWitness(usuarioId, input.votingTableId, true)
    if (!asignada.success) {
      aviso = `La cuenta se creó, pero no se pudo asignar la mesa: ${asignada.error}`
    } else if (input.tambienVotaAhi && voterId) {
      const db = getTenantDb(await getTenantConnection(tenantId))
      await db.voter.update({ where: { id: voterId }, data: { votingTableId: input.votingTableId } })
    }
  }

  revalidatePath('/core/usuarios')
  revalidatePath('/core/electores')
  revalidatePath('/dia-e/sala')
  return { success: true, aviso }
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
    return {
      success: false,
      error: 'No puedes dejar a un testigo sin elector: ahí vive la cédula que pide la Registraduría.',
    }
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
  revalidatePath('/core/usuarios')
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
  revalidatePath('/core/usuarios')
  return { success: true }
}
