#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Resetea la contraseña de un usuario del panel (User vive en la DB del
 * superadmin). Existe porque el flujo de "olvidé mi contraseña" manda correo y
 * todavía no hay SMTP configurado.
 *
 * Desde packages/db:
 *   tsx src/resetear-password.ts                      → lista los usuarios
 *   tsx src/resetear-password.ts correo@x.com 'clave' → le pone esa contraseña
 */

import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import bcrypt from 'bcryptjs'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

const [email, password] = process.argv.slice(2)

async function main() {
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }) })
  if (!email) {
    const todos = await db.user.findMany({ select: { email: true, role: true, isActive: true, tenantId: true } })
    console.table(todos)
  } else {
    const u = await db.user.update({
      where: { email },
      data: { passwordHash: await bcrypt.hash(password!, 10), isActive: true },
      select: { email: true, role: true },
    })
    console.log('listo:', u.email, u.role)
  }
  await db.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
