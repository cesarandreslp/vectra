#!/usr/bin/env tsx
import { config } from 'dotenv'; config({ path: '../../.env' })

/**
 * Crea (no-interactivo) un SUPERADMIN de prueba con contraseña conocida, para
 * poder entrar al SaaS y crear el tenant por la UI. SOLO desarrollo.
 * Equivalente no-interactivo de db:create-superadmin.
 *
 * Correr desde packages/db:  tsx src/seed-superadmin-test.ts
 */
import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import bcrypt from 'bcryptjs'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

const SUPERADMIN_TENANT_ID = '__superadmin__'
const EMAIL    = 'superadmin@test.local'
const PASSWORD = 'Superadmin2026!'   // >=12, solo test

async function main() {
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }) })
  try {
    const hash = await bcrypt.hash(PASSWORD, 12)
    const existente = await db.user.findUnique({ where: { email: EMAIL } })
    if (existente) {
      await db.user.update({ where: { id: existente.id }, data: { passwordHash: hash, role: 'SUPERADMIN', isActive: true, tenantId: SUPERADMIN_TENANT_ID } })
      console.log('Superadmin ya existía — contraseña restablecida.')
    } else {
      await db.user.create({ data: { tenantId: SUPERADMIN_TENANT_ID, email: EMAIL, passwordHash: hash, role: 'SUPERADMIN', isActive: true } })
      console.log('Superadmin creado.')
    }
    console.log(`\n  Login SaaS:  /superadmin/login`)
    console.log(`  Email:       ${EMAIL}`)
    console.log(`  Contraseña:  ${PASSWORD}\n`)
  } finally {
    await db.$disconnect()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
