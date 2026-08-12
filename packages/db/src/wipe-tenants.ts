#!/usr/bin/env tsx
import { config } from 'dotenv'; config({ path: '../../.env' })

/**
 * Limpia los datos de tenants dejando intacta la DIVIPOLA global.
 * 1) Respalda a JSON TODAS las tablas que se van a borrar.
 * 2) Solo si el backup quedó escrito, hace TRUNCATE ... CASCADE de esas tablas.
 *
 * CONSERVA: Department, Municipality, Commune, Neighborhood, VotingStation,
 *           VotingTable (DIVIPOLA global), GlobalTrainingMaterial, _prisma_migrations.
 *
 * Correr desde packages/db:  tsx src/wipe-tenants.ts <ruta-backup.json>
 */
import { writeFileSync } from 'fs'
import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'; neonConfig.webSocketConstructor = ws

const KEEP = new Set([
  'Department', 'Municipality', 'Commune', 'Neighborhood', 'VotingStation', 'VotingTable',
  'GlobalTrainingMaterial', '_prisma_migrations',
])

async function main() {
  const backupPath = process.argv[2]
  if (!backupPath) { console.error('Falta la ruta del backup'); process.exit(1) }

  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }) })

  // 1. Descubrir todas las tablas públicas
  const tablas = (await db.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name::text AS table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
  )).map(r => r.table_name)

  const aBorrar = tablas.filter(t => !KEEP.has(t)).sort()
  const aConservar = tablas.filter(t => KEEP.has(t)).sort()
  console.log(`Tablas a CONSERVAR (${aConservar.length}): ${aConservar.join(', ')}`)
  console.log(`Tablas a BORRAR   (${aBorrar.length}): ${aBorrar.join(', ')}\n`)

  // 2. Backup
  const dump: Record<string, unknown[]> = {}
  let totalFilas = 0
  for (const t of aBorrar) {
    const filas = await db.$queryRawUnsafe<unknown[]>(`SELECT * FROM "${t}"`)
    dump[t] = filas
    totalFilas += filas.length
  }
  const json = JSON.stringify(dump, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
  writeFileSync(backupPath, json, 'utf8')
  console.log(`Backup escrito: ${backupPath}  (${totalFilas} filas, ${(json.length/1024).toFixed(1)} KB)\n`)

  // 3. TRUNCATE (solo si el backup existe y tiene contenido)
  if (json.length < 2) { console.error('Backup vacío — aborto el borrado.'); process.exit(1) }
  const lista = aBorrar.map(t => `"${t}"`).join(', ')
  await db.$executeRawUnsafe(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`)
  console.log('TRUNCATE ejecutado.\n')

  // 4. Verificación
  const tenantCount = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::int AS n FROM "Tenant"`)
  const voterCount  = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::int AS n FROM "Voter"`)
  const mesaCount   = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::int AS n FROM "VotingTable"`)
  const muniCount   = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::int AS n FROM "Municipality"`)
  console.log(`Post-borrado → Tenant=${tenantCount[0].n} Voter=${voterCount[0].n}  |  DIVIPOLA intacta: VotingTable=${mesaCount[0].n} Municipality=${muniCount[0].n}`)

  await db.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
