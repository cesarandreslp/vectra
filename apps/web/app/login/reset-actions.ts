'use server'

/**
 * Restablecer contraseña por correo. Rutas públicas: cualquiera puede pedirlo,
 * así que estas actions NUNCA revelan si un correo existe ni por el mensaje ni
 * por el error — siempre responden lo mismo.
 *
 * El correo sale por el SMTP del tenant del usuario (Comunicaciones →
 * Configuración). Sin SMTP configurado no hay forma de enviarlo: queda el
 * script `packages/db/src/reset-password.ts` como respaldo por CLI.
 */

import { headers } from 'next/headers'
import bcrypt from 'bcryptjs'
import { superadminDb, getTenantDb, decrypt } from '@vectra/db'
import { SmtpEmailProvider, type SmtpConfig } from '@vectra/messaging'
import { crearResetToken, leerResetToken, userIdDelToken } from '@/lib/reset-token'

const RESPUESTA_GENERICA = {
  success: true,
  message: 'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña. Revisá tu bandeja (y el spam).',
} as const

async function baseUrl(): Promise<string> {
  const h = await headers()
  const host = h.get('host') ?? new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').host
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

// ponytail: el SUPERADMIN no pertenece a ningún tenant, así que no tiene SMTP y
// solo se recupera por CLI. Si hace falta, agregar un SMTP de plataforma por env.
async function smtpDelTenant(tenantId: string): Promise<SmtpConfig | null> {
  const tenant = await superadminDb.tenant.findUnique({ where: { id: tenantId }, select: { connectionString: true } })
  if (!tenant) return null
  const db = getTenantDb(decrypt(tenant.connectionString))
  try {
    const config = await db.tenantConfig.findUnique({ where: { tenantId }, select: { smtpConfig: true } })
    return (config?.smtpConfig as unknown as SmtpConfig) ?? null
  } finally {
    await db.$disconnect()
  }
}

export async function solicitarReset(email: string) {
  const usuario = await superadminDb.user.findUnique({
    where:  { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true, passwordHash: true, tenantId: true, isActive: true },
  })
  if (!usuario || !usuario.isActive) return RESPUESTA_GENERICA

  const smtp = await smtpDelTenant(usuario.tenantId)
  if (!smtp) {
    console.error(`[reset] ${usuario.email}: el tenant ${usuario.tenantId} no tiene SMTP configurado`)
    return RESPUESTA_GENERICA
  }

  const enlace = `${await baseUrl()}/login/restablecer?token=${encodeURIComponent(crearResetToken(usuario.id, usuario.passwordHash))}`
  const resultado = await new SmtpEmailProvider(smtp).send({
    to:      usuario.email,
    channel: 'EMAIL',
    subject: 'Restablecer tu contraseña',
    body: `
      <p>Hola${usuario.name ? ` ${usuario.name}` : ''},</p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
      <p><a href="${enlace}">Restablecer mi contraseña</a></p>
      <p>El enlace vence en 1 hora y sirve una sola vez. Si no fuiste vos, ignorá este correo: tu contraseña sigue igual.</p>
    `,
  })
  if (!resultado.success) console.error(`[reset] fallo el envío a ${usuario.email}: ${resultado.error}`)

  return RESPUESTA_GENERICA
}

export async function restablecerPassword(token: string, password: string) {
  if (password.length < 8) return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' }

  const userId = userIdDelToken(token)
  const usuario = userId
    ? await superadminDb.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true } })
    : null
  if (!usuario || leerResetToken(token, () => usuario.passwordHash) !== usuario.id) {
    return { success: false, error: 'El enlace ya venció o no es válido. Pedí uno nuevo.' }
  }

  await superadminDb.user.update({ where: { id: usuario.id }, data: { passwordHash: await bcrypt.hash(password, 12) } })
  return { success: true }
}
