/**
 * Fija una contraseña CONOCIDA a los usuarios de prueba (uno por rol) para
 * poder iniciar sesión en local/producción con datos de prueba. SOLO test.
 * No crea nada nuevo: solo actualiza el passwordHash de usuarios @test.local
 * que ya existan, e imprime email + contraseña + tenant para el login.
 *
 * Correr desde packages/db:  tsx src/reset-test-passwords.mts
 */
import { config } from 'dotenv'
config({ path: '../../.env' })

import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import bcrypt from 'bcryptjs'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

const PASSWORD = 'Prueba2026!'                       // conocida, solo para test
const EMAILS = [
  'superadmin@test.local',
  'admin@test.local',
  'coordinador@test.local',
  'lider@test.local',
  'testigo@test.local',
]

async function main() {
  const connectionString = process.env.DATABASE_URL_SUPERADMIN
  if (!connectionString) { console.error('Falta DATABASE_URL_SUPERADMIN'); process.exit(1) }

  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
  try {
    const hash = await bcrypt.hash(PASSWORD, 12)
    const tenants = new Map((await db.tenant.findMany({ select: { id: true, slug: true, name: true } }))
      .map(t => [t.id, `${t.name} (${t.slug})`]))

    console.log('\nRol / Email                       | Tenant                         | Contraseña')
    console.log('----------------------------------|--------------------------------|------------')
    for (const email of EMAILS) {
      const u = await db.user.findUnique({ where: { email }, select: { id: true, role: true, tenantId: true } })
      if (!u) { console.log(`${email.padEnd(33)} | (no existe — correr db:create-test-users)`); continue }
      await db.user.update({ where: { id: u.id }, data: { passwordHash: hash, isActive: true } })
      const t = u.tenantId === '__superadmin__' ? 'SUPERADMIN (global)' : (tenants.get(u.tenantId) ?? u.tenantId)
      console.log(`${(u.role + ' ' + email).padEnd(33)} | ${String(t).padEnd(30)} | ${PASSWORD}`)
    }
    console.log('')
  } finally {
    await db.$disconnect()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
