#!/usr/bin/env tsx
/**
 * Aplica las migraciones pendientes de Prisma a la BD de CADA tenant activo.
 *
 * Los tenants se provisionan con `prisma migrate deploy` (ver neon-provisioner),
 * así que un cambio de schema solo llega a los tenants existentes si alguien
 * corre migrate deploy contra cada uno. Esto es ese "alguien".
 *
 * Correr desde packages/db:  tsx src/migrate-tenants.ts
 */
import { config } from 'dotenv'
config({ path: '../../.env' })

import { execFileSync } from 'child_process'
import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

async function main() {
  const superadmin = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }),
  })
  const tenants = await superadmin.tenant.findMany({
    where:  { isActive: true },
    select: { slug: true, connectionString: true },
  })
  await superadmin.$disconnect()

  let fallos = 0
  for (const t of tenants) {
    try {
      execFileSync(
        process.execPath,
        [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
        {
          // La connectionString nunca se imprime: va por env y stdio es 'pipe'.
          env:      { ...process.env, DATABASE_URL: decrypt(t.connectionString) },
          stdio:    'pipe',
          encoding: 'utf8',
        }
      )
      console.log(`  OK  ${t.slug}`)
    } catch (err) {
      fallos++
      const e = err as { stdout?: string; stderr?: string }
      console.log(`  XX  ${t.slug}: ${(e.stderr || e.stdout || String(err)).trim()}`)
    }
  }
  process.exit(fallos > 0 ? 1 : 0)
}
main()
