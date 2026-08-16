import NextAuth, { type DefaultSession, type NextAuthResult } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { superadminDb, getTenantDb, decrypt } from '@vectra/db'

// ── Tipos de sesión ───────────────────────────────────────────────────────────
// Extender las interfaces de NextAuth para incluir los campos del dominio.

/**
 * Roles del sistema. SUPERADMIN..TESTIGO deben mantenerse sincronizados con el
 * enum UserRole del schema Prisma (respaldados por una fila en User). ELECTOR
 * es solo de sesión — un Voter que entra con cédula+teléfono nunca tiene fila
 * en User, así que no existe en el enum de Prisma.
 */
export type UserRole =
  | 'SUPERADMIN'
  | 'ADMIN_CAMPANA'
  | 'COORDINADOR'
  | 'LIDER'
  | 'TESTIGO'
  | 'PERSONALIZADO'
  | 'ELECTOR'

/** Permisos resueltos de un CustomRole (role=PERSONALIZADO), por screenKey. */
export type CustomPermissions = Record<string, { canView: boolean; canEdit: boolean }>

// El tenantId del superadmin — debe coincidir con create-superadmin.ts
export const SUPERADMIN_TENANT_ID = '__superadmin__'

// Declaración de módulo para extender los tipos globales de NextAuth
declare module 'next-auth' {
  interface Session {
    user: {
      /** ID del usuario en la DB del superadmin */
      userId: string
      /** ID del tenant al que pertenece el usuario, o '__superadmin__' */
      tenantId: string
      /** Slug del tenant (null para SUPERADMIN). Útil para construir URLs con subdominio. */
      tenantSlug: string | null
      /** Nombre visible del tenant (null para SUPERADMIN). Para mostrar en UI. */
      tenantName: string | null
      /** Rol del usuario dentro de la campaña */
      role: UserRole
      /** Claves de módulos activos para este tenant (vacío para SUPERADMIN) */
      activeModules: string[]
      /** Voter.id de este usuario en la DB del tenant (null si no está vinculado) — acota "mi gente" para LIDER */
      voterId: string | null
      /** Solo si role=PERSONALIZADO — permisos resueltos una vez en el login, igual que activeModules. */
      customPermissions: CustomPermissions
    } & DefaultSession['user']
  }

  interface JWT {
    userId: string
    tenantId: string
    tenantSlug: string | null
    tenantName: string | null
    role: UserRole
    activeModules: string[]
    voterId: string | null
    customPermissions: CustomPermissions
  }
}

// ── Autenticación universal ───────────────────────────────────────────────────
// Un solo authorize que busca al user por email globalmente en superadminDb.
// El subdominio del request es irrelevante para la autenticación: la fuente de
// verdad del tenant es el JWT que se emite tras un login exitoso.

interface ResultadoAuth {
  id:                string
  email:             string
  name:              string
  role:              UserRole
  tenantId:          string
  tenantSlug:        string | null
  tenantName:        string | null
  activeModules:     string[]
  voterId:           string | null
  customPermissions: CustomPermissions
}

/** Resuelve los permisos de un CustomRole una sola vez, para cachear en el JWT. */
async function resolverCustomPermissions(customRoleId: string | null): Promise<CustomPermissions> {
  if (!customRoleId) return {}
  const permisos = await superadminDb.customRolePermission.findMany({ where: { roleId: customRoleId } })
  const mapa: CustomPermissions = {}
  for (const p of permisos) mapa[p.screenKey] = { canView: p.canView, canEdit: p.canEdit }
  return mapa
}

/**
 * @param soloSuperadmin - true desde el provider "superadmin" (/superadmin/login),
 *   false desde el provider "credentials" (/login de tenant). Antes un mismo
 *   email+contraseña de ADMIN_CAMPANA funcionaba en cualquiera de las dos
 *   puertas — cada provider ahora exige que el usuario sea del lado que le
 *   corresponde, o falla igual que credenciales inválidas.
 */
async function autenticarUsuario(email: string, password: string, soloSuperadmin: boolean): Promise<ResultadoAuth | null> {
  const usuario = await superadminDb.user.findUnique({ where: { email } })

  if (!usuario || !usuario.isActive) return null

  // El testigo tiene UN solo acceso: /testigo/login con cédula + fecha de
  // nacimiento. Correo+contraseña es para el staff (admin/coordinador/líder),
  // así que acá se rechaza — que no haya dos puertas para el mismo rol.
  if (usuario.role === 'TESTIGO') return null

  const esSuperadmin = usuario.tenantId === SUPERADMIN_TENANT_ID
  if (esSuperadmin !== soloSuperadmin) return null

  const passwordValida = await bcrypt.compare(password, usuario.passwordHash)
  if (!passwordValida) return null

  // SUPERADMIN no tiene tenant asociado; sus módulos son vacíos.
  if (usuario.tenantId === SUPERADMIN_TENANT_ID) {
    return {
      id:                usuario.id,
      email:             usuario.email,
      name:              usuario.name ?? usuario.email,
      role:              usuario.role as UserRole,
      tenantId:          SUPERADMIN_TENANT_ID,
      tenantSlug:        null,
      tenantName:        null,
      activeModules:     [],
      voterId:           null,
      customPermissions: {},
    }
  }

  // Usuario de tenant: traer slug + módulos activos para inyectar en el JWT.
  const tenant = await superadminDb.tenant.findUnique({
    where: { id: usuario.tenantId },
    include: {
      modules: {
        where:  { isActive: true },
        select: { moduleKey: true },
      },
    },
  })

  // Tenant inactivo o eliminado → bloquear login.
  if (!tenant || !tenant.isActive) return null

  const customPermissions = usuario.role === 'PERSONALIZADO'
    ? await resolverCustomPermissions(usuario.customRoleId)
    : {}

  return {
    id:                usuario.id,
    email:             usuario.email,
    name:              usuario.name ?? usuario.email,
    role:              usuario.role as UserRole,
    tenantId:          tenant.id,
    tenantSlug:        tenant.slug,
    tenantName:        tenant.name,
    activeModules:     tenant.modules.map((m) => m.moduleKey),
    voterId:           usuario.voterId,
    customPermissions,
  }
}

// ── Autenticación de electores (cédula + teléfono) ────────────────────────────
// Login propio para Voters — nunca pasan por User/bcrypt. El tenant se resuelve
// por slug (viene en la URL, igual que /registro/[token]?c=slug) porque acá no
// hay subdominio configurado que lo resuelva. La cédula se busca por su hash
// (nunca se guarda en plano); el teléfono se descifra solo del candidato ya
// encontrado por cédula, y se compara solo por dígitos (tolera espacios/guiones).
//
// Advertencia de seguridad asumida a propósito: cédula y teléfono no son un
// secreto fuerte (circulan fácil). Aceptable para una app de campaña, no para
// datos sensibles — si eso cambia, esto necesita un factor más fuerte.

function soloDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

async function autenticarElector(slug: string, cedula: string, telefono: string): Promise<ResultadoAuth | null> {
  const tenant = await superadminDb.tenant.findUnique({
    where: { slug },
    include: { modules: { where: { isActive: true }, select: { moduleKey: true } } },
  })
  if (!tenant || !tenant.isActive) return null

  let connectionString: string
  try {
    connectionString = decrypt(tenant.connectionString)
  } catch {
    return null
  }
  const db = getTenantDb(connectionString)

  const cedulaHash = createHash('sha256').update(cedula.trim()).digest('hex')
  const voter = await db.voter.findFirst({ where: { tenantId: tenant.id, cedulaHash } })
  if (!voter || !voter.phone) return null

  // Un testigo TAMBIÉN es elector: puede entrar por acá con cédula+teléfono a la
  // PWA de electores. Es otra puerta, a otra superficie. Sus deberes de día E van
  // por /testigo/login (cédula+fecha) → su mesa. Las dos conviven sin chocar.

  let telefonoGuardado: string
  try {
    telefonoGuardado = decrypt(voter.phone)
  } catch {
    return null
  }
  if (soloDigitos(telefonoGuardado) !== soloDigitos(telefono)) return null

  return {
    id:                `voter:${voter.id}`,
    email:             '',
    name:              voter.apodo?.trim() || voter.name,
    role:              'ELECTOR',
    tenantId:          tenant.id,
    tenantSlug:        tenant.slug,
    tenantName:        tenant.name,
    activeModules:     tenant.modules.map((m) => m.moduleKey),
    voterId:           voter.id,
    customPermissions: {},
  }
}

// ── Autenticación de testigos (cédula + fecha de nacimiento) ──────────────────
// Acceso propio del testigo, distinto del de electores (cédula+teléfono) y del de
// staff (correo+contraseña). La fecha de nacimiento es su segundo factor y a la
// vez el dato que lo hace apto para votar/vigilar. Misma advertencia que el login
// de electores: es conocimiento, no un secreto fuerte — coherente con ese modelo.
async function autenticarTestigo(slug: string, cedula: string, fechaNac: string): Promise<ResultadoAuth | null> {
  const tenant = await superadminDb.tenant.findUnique({
    where: { slug },
    include: { modules: { where: { isActive: true }, select: { moduleKey: true } } },
  })
  if (!tenant || !tenant.isActive) return null

  let connectionString: string
  try {
    connectionString = decrypt(tenant.connectionString)
  } catch {
    return null
  }
  const db = getTenantDb(connectionString)

  const cedulaHash = createHash('sha256').update(cedula.trim()).digest('hex')
  const voter = await db.voter.findFirst({
    where:  { tenantId: tenant.id, cedulaHash },
    select: { id: true, name: true, apodo: true, birthDate: true },
  })
  if (!voter || !voter.birthDate) return null

  // Comparar solo la fecha (YYYY-MM-DD), sin hora. Se guarda a medianoche UTC.
  if (voter.birthDate.toISOString().slice(0, 10) !== fechaNac.trim()) return null

  // Tiene que existir la cuenta TESTIGO activa vinculada a ese elector.
  const usuario = await superadminDb.user.findFirst({
    where:  { tenantId: tenant.id, voterId: voter.id, role: 'TESTIGO', isActive: true },
    select: { id: true },
  })
  if (!usuario) return null

  return {
    id:                usuario.id,
    email:             '',
    name:              voter.apodo?.trim() || voter.name,
    role:              'TESTIGO',
    tenantId:          tenant.id,
    tenantSlug:        tenant.slug,
    tenantName:        tenant.name,
    activeModules:     tenant.modules.map((m) => m.moduleKey),
    voterId:           voter.id,
    customPermissions: {},
  }
}

// ── Configuración de NextAuth v5 ──────────────────────────────────────────────

const nextAuth: NextAuthResult = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email:    { label: 'Correo electrónico', type: 'email' },
        password: { label: 'Contraseña',         type: 'password' },
      },
      async authorize(credentials) {
        const email    = credentials?.email    as string | undefined
        const password = credentials?.password as string | undefined

        if (!email || !password) return null

        return autenticarUsuario(email, password, false)
      },
    }),

    // Login exclusivo del SUPERADMIN (/superadmin/login) — provider separado para
    // que un email+contraseña de tenant nunca sirva para entrar al panel del SaaS,
    // ni viceversa. Ver autenticarUsuario() arriba.
    Credentials({
      id:   'superadmin',
      name: 'superadmin',
      credentials: {
        email:    { label: 'Correo electrónico', type: 'email' },
        password: { label: 'Contraseña',         type: 'password' },
      },
      async authorize(credentials) {
        const email    = credentials?.email    as string | undefined
        const password = credentials?.password as string | undefined

        if (!email || !password) return null

        return autenticarUsuario(email, password, true)
      },
    }),

    // Login de electores por cédula + teléfono — provider separado (id: "elector")
    // para no tocar el flujo de staff. Ver autenticarElector() arriba.
    Credentials({
      id:   'elector',
      name: 'elector',
      credentials: {
        slug:     { label: 'Campaña',  type: 'text' },
        cedula:   { label: 'Cédula',   type: 'text' },
        telefono: { label: 'Teléfono', type: 'text' },
      },
      async authorize(credentials) {
        const slug     = credentials?.slug     as string | undefined
        const cedula   = credentials?.cedula   as string | undefined
        const telefono = credentials?.telefono as string | undefined

        if (!slug || !cedula || !telefono) return null

        return autenticarElector(slug, cedula, telefono)
      },
    }),

    // Login de testigos por cédula + fecha de nacimiento — provider separado
    // (id: "testigo") para que un testigo nunca entre por el de electores.
    Credentials({
      id:   'testigo',
      name: 'testigo',
      credentials: {
        slug:      { label: 'Campaña',            type: 'text' },
        cedula:    { label: 'Cédula',             type: 'text' },
        birthDate: { label: 'Fecha de nacimiento', type: 'text' },
      },
      async authorize(credentials) {
        const slug      = credentials?.slug      as string | undefined
        const cedula    = credentials?.cedula    as string | undefined
        const birthDate = credentials?.birthDate as string | undefined

        if (!slug || !cedula || !birthDate) return null

        return autenticarTestigo(slug, cedula, birthDate)
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as ResultadoAuth
        token.userId        = u.id
        token.tenantId      = u.tenantId
        token.tenantSlug    = u.tenantSlug
        token.tenantName    = u.tenantName
        token.role          = u.role
        token.activeModules = u.activeModules
        token.voterId       = u.voterId
        token.customPermissions = u.customPermissions
      }
      return token
    },

    async session({ session, token }) {
      session.user.userId        = token.userId        as string
      session.user.tenantId      = token.tenantId      as string
      session.user.tenantSlug    = token.tenantSlug    as string | null
      session.user.tenantName    = token.tenantName    as string | null
      session.user.role          = token.role          as UserRole
      session.user.activeModules = token.activeModules as string[]
      session.user.voterId       = token.voterId        as string | null
      session.user.customPermissions = token.customPermissions as CustomPermissions
      return session
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  session: {
    strategy: 'jwt',
  },
})

export const handlers: NextAuthResult['handlers'] = nextAuth.handlers
export const signIn:   NextAuthResult['signIn']   = nextAuth.signIn
export const signOut:  NextAuthResult['signOut']  = nextAuth.signOut
export const auth:     NextAuthResult['auth']     = nextAuth.auth
