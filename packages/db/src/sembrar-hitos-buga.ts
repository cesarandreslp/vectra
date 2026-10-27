#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Siembra los hitos de PRUEBA del plan de la estructura para las campañas de
 * Buga (TenantConfig.electionMunicipalityDivipola = 76111), y la meta de 1.300
 * votos del concejo si la campaña aún no tiene meta. La app no trae ningún
 * hito propio: estos viven solo acá.
 *
 * Idempotente: no duplica un hito si ya hay uno en esa fecha.
 *
 * Uso desde packages/db:  tsx src/sembrar-hitos-buga.ts
 */

import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const DIVIPOLA = '76111'
const META     = 1300
// fecha, contactos, compromisos, líderes, multiplicadores
const HITOS: [string, number, number, number, number][] = [
  ['2027-03-31', 1000,  300,  5,  40],
  ['2027-06-30', 2200,  700, 10,  80],
  ['2027-09-30', 3500, 1300, 13, 120],
  ['2027-10-31', 4000, 1600, 13, 130],
]

async function main() {
  const superadmin = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }),
  })
  const tenants = await superadmin.tenant.findMany({
    where:  { isActive: true },
    select: { id: true, slug: true, connectionString: true },
  })
  await superadmin.$disconnect()

  for (const t of tenants) {
    const db  = new PrismaClient({ adapter: new PrismaNeon({ connectionString: decrypt(t.connectionString) }) })
    const cfg = await db.tenantConfig.findUnique({ where: { tenantId: t.id } })
    if (cfg?.electionMunicipalityDivipola !== DIVIPOLA) {
      console.log(`  --  ${t.slug}: no es campaña de Buga, se omite`)
      await db.$disconnect(); continue
    }

    if (!cfg.metaVotos) await db.tenantConfig.update({ where: { tenantId: t.id }, data: { metaVotos: META } })

    let creados = 0
    for (const [f, contactos, compromisos, lideres, multiplicadores] of HITOS) {
      const fecha = new Date(`${f}T00:00:00Z`)
      if (await db.hitoEstructura.findFirst({ where: { tenantId: t.id, fecha }, select: { id: true } })) continue
      await db.hitoEstructura.create({ data: { tenantId: t.id, fecha, contactos, compromisos, lideres, multiplicadores } })
      creados++
    }
    console.log(`  OK  ${t.slug}: ${creados} hitos nuevos${cfg.metaVotos ? '' : `, meta ${META}`}`)
    await db.$disconnect()
  }
}
main()
