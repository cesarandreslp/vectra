#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Recuperación de acceso por CLI: fija una contraseña nueva a un usuario real.
 * Requiere acceso a la DB del superadmin, así que solo lo puede correr quien
 * ya administra la infraestructura.
 *
 * Correr desde packages/db:
 *   tsx src/reset-password.ts admin@indignos.com            → genera una temporal
 *   tsx src/reset-password.ts admin@indignos.com MiClave123 → fija la que le pases
 */
import { randomBytes } from 'crypto'
import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import bcrypt from 'bcryptjs'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

async function main() {
  const [email, passwordArg] = process.argv.slice(2)
  if (!email) { console.error('Uso: tsx src/reset-password.ts <email> [contraseña]'); process.exit(1) }

  const password = passwordArg ?? `Vectra-${randomBytes(4).toString('hex')}!`
  if (password.length < 8) { console.error('La contraseña debe tener al menos 8 caracteres.'); process.exit(1) }

  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }) })
  try {
    const u = await db.user.findUnique({ where: { email }, select: { id: true, role: true, isActive: true } })
    if (!u) { console.error(`No existe ningún usuario con el correo ${email}`); process.exit(1) }

    await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(password, 12), isActive: true } })
    console.log(`\n  Usuario:     ${email} (${u.role})${u.isActive ? '' : ' — estaba inactivo, quedó activo'}`)
    console.log(`  Contraseña:  ${password}`)
    console.log(`  Cambiala apenas entres.\n`)
  } finally {
    await db.$disconnect()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
