/**
 * Helpers de autorización para Server Actions y Server Components.
 *
 * Uso típico en una Server Action:
 *   const session = await requireAuth(['ADMIN_CAMPANA', 'COORDINADOR'])
 *   // Si llega aquí, session.user.role es uno de los roles permitidos
 */

import { auth } from '@vectra/auth'
import { type UserRole } from '@vectra/auth'
import { type Session } from 'next-auth'
import { redirect } from 'next/navigation'

// ── Errores tipados ───────────────────────────────────────────────────────────

/** Lanzado cuando el usuario no tiene sesión activa */
export class NoAutenticadoError extends Error {
  constructor() {
    super('No autenticado. Inicia sesión para continuar.')
    this.name = 'NoAutenticadoError'
  }
}

/** Lanzado cuando el usuario no tiene el rol requerido */
export class NoAutorizadoError extends Error {
  constructor(rolesRequeridos: UserRole[]) {
    super(`Acceso denegado. Roles requeridos: ${rolesRequeridos.join(', ')}.`)
    this.name = 'NoAutorizadoError'
  }
}

/** Lanzado cuando el módulo requerido no está activo para el tenant */
export class ModuloInactivoError extends Error {
  constructor(moduleKey: string) {
    super(`El módulo "${moduleKey}" no está activo para este tenant.`)
    this.name = 'ModuloInactivoError'
  }
}

// ── Tipo de sesión verificada ─────────────────────────────────────────────────
// NextAuth v5 exporta `auth` como función sobrecargada (middleware + session getter).
// ReturnType<typeof auth> resuelve al tipo de middleware, no al de sesión.
// Usamos Session directamente para evitar el problema.

type SessionVerificada = Session & { user: NonNullable<Session['user']> }

// ── requireAuth ───────────────────────────────────────────────────────────────

/**
 * Verifica que el caller tiene sesión activa y uno de los roles permitidos.
 *
 * Uso en Server Actions: lanza NoAutenticadoError / NoAutorizadoError.
 * Uso en Server Components: usar requireAuthOrRedirect() en su lugar.
 *
 * @param rolesPermitidos - Lista de roles que pueden ejecutar la acción.
 *                          Si está vacía, acepta cualquier rol autenticado.
 * @returns La sesión verificada (nunca null)
 * @throws NoAutenticadoError si no hay sesión
 * @throws NoAutorizadoError si el rol no está en la lista
 */
export async function requireAuth(rolesPermitidos: UserRole[] = []): Promise<SessionVerificada> {
  const session = await auth()

  if (!session?.user) {
    throw new NoAutenticadoError()
  }

  if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(session.user.role)) {
    throw new NoAutorizadoError(rolesPermitidos)
  }

  return session as unknown as SessionVerificada
}

// ── requireModule ─────────────────────────────────────────────────────────────

/**
 * Verifica que el tenant del caller tiene el módulo requerido activo.
 * Llama a requireAuth() internamente — no necesitas llamarlo antes.
 *
 * @param moduleKey   - Clave del módulo requerido (ej: 'ANALYTICS')
 * @param rolesPermitidos - Roles adicionales requeridos (opcional)
 * @throws ModuloInactivoError si el módulo no está activo
 */
export async function requireModule(
  moduleKey: string,
  rolesPermitidos: UserRole[] = [],
): Promise<SessionVerificada> {
  const session = await requireAuth(rolesPermitidos)

  if (!session.user.activeModules.includes(moduleKey)) {
    throw new ModuloInactivoError(moduleKey)
  }

  return session
}

// ── requireAuthOrRedirect ─────────────────────────────────────────────────────

/**
 * Versión para Server Components: redirige en lugar de lanzar.
 * Útil en layouts y páginas protegidas.
 *
 * @param rolesPermitidos    - Lista de roles permitidos
 * @param rutaLogin          - Ruta de login a la que redirigir si no hay sesión
 * @param screensPersonalizado - screenKeys de CustomRolePermission que también dan
 *                                entrada (basta con canView en uno solo) — para dejar
 *                                pasar usuarios role=PERSONALIZADO al layout del módulo.
 */
export async function requireAuthOrRedirect(
  rolesPermitidos: UserRole[] = [],
  rutaLogin: string = '/login',
  screensPersonalizado: string[] = [],
): Promise<SessionVerificada> {
  const session = await auth()

  if (!session?.user) {
    redirect(rutaLogin)
  }

  const rolOk = rolesPermitidos.length === 0 || rolesPermitidos.includes(session.user.role)
  const personalizadoOk = !rolOk
    && session.user.role === 'PERSONALIZADO'
    && screensPersonalizado.some((k) => session.user.customPermissions?.[k]?.canView)

  if (!rolOk && !personalizadoOk) {
    redirect('/no-autorizado')
  }

  return session as unknown as SessionVerificada
}

// ── requireModuleOrRedirect ───────────────────────────────────────────────────

/**
 * Versión para PÁGINAS Y LAYOUTS de requireModule / requireModuleOrScreen.
 *
 * Los helpers que lanzan están pensados para Server Actions, donde el error lo
 * recoge el try/catch de la acción. En un Server Component nadie los atrapa: la
 * excepción sube hasta Next y el usuario ve un "Application error" 500 en vez
 * de la pantalla /no-autorizado que ya existe. Por eso una página nunca debe
 * usar la variante que lanza.
 *
 * No se puede resolver con un error.tsx: en producción Next no le pasa el tipo
 * ni el mensaje del error al boundary (solo un digest), así que ahí es
 * imposible distinguir "no autorizado" de cualquier otra falla.
 *
 * @param screenKey - Opcional. Deja pasar además a un role=PERSONALIZADO con
 *                    permiso de vista sobre esa pantalla, igual que
 *                    requireModuleOrScreen.
 */
export async function requireModuleOrRedirect(
  moduleKey: string,
  rolesPermitidos: UserRole[] = [],
  screenKey?: string | string[],
): Promise<SessionVerificada> {
  const session = await auth()
  if (!session?.user) redirect('/login')

  if (!session.user.activeModules.includes(moduleKey)) redirect('/no-autorizado')

  const rolOk = rolesPermitidos.length === 0 || rolesPermitidos.includes(session.user.role)
  if (rolOk) return session as unknown as SessionVerificada

  if (screenKey && session.user.role === 'PERSONALIZADO') {
    const claves = Array.isArray(screenKey) ? screenKey : [screenKey]
    if (claves.some((k) => session.user.customPermissions?.[k]?.canView)) {
      return session as unknown as SessionVerificada
    }
  }

  redirect('/no-autorizado')
}

// ── requireModuleOrScreen ─────────────────────────────────────────────────────

/**
 * Como requireModule, pero además deja pasar a un usuario role=PERSONALIZADO
 * si su CustomRole tiene permiso sobre `screenKey` — sin tocar el chequeo de
 * rol fijo existente (ADMIN_CAMPANA etc. siguen pasando exactamente igual).
 *
 * @param screenKey - Uno o varios screenKeys (ver apps/web/lib/screens.ts) — basta
 *                    con permiso en cualquiera de ellos. Útil para funciones
 *                    compartidas por más de una pantalla (ej. listVoters, usado
 *                    tanto en Electores como en la ficha de Líder).
 * @param accion    - 'view' (default) o 'edit' — cuál permiso de CustomRolePermission mirar.
 */
export async function requireModuleOrScreen(
  moduleKey: string,
  rolesPermitidos: UserRole[],
  screenKey: string | string[],
  accion: 'view' | 'edit' = 'view',
): Promise<SessionVerificada> {
  const session = await requireAuth()

  if (rolesPermitidos.includes(session.user.role)) {
    if (!session.user.activeModules.includes(moduleKey)) throw new ModuloInactivoError(moduleKey)
    return session
  }

  if (session.user.role === 'PERSONALIZADO' && session.user.activeModules.includes(moduleKey)) {
    const screenKeys = Array.isArray(screenKey) ? screenKey : [screenKey]
    const tienePermiso = screenKeys.some((k) => {
      const permiso = session.user.customPermissions[k]
      return permiso && (accion === 'view' ? permiso.canView : permiso.canEdit)
    })
    if (tienePermiso) return session
  }

  throw new NoAutorizadoError([...rolesPermitidos, 'PERSONALIZADO'])
}
