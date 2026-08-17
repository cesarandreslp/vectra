#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Zonas electorales de PRUEBA para Buga: crea unas cuantas y reparte los puestos
 * existentes entre ellas, para que el E-14 se vea realista en el demo. Datos
 * ficticios — al limpiar la base e importar la DIVIPOLA/territorio real, cada
 * puesto queda en su zona verdadera.
 *
 * Idempotente en las zonas (upsert por código) y reparte TODOS los puestos de
 * Buga de forma determinista.
 *
 * Uso desde packages/db:  tsx src/sembrar-zonas-prueba.ts
 */

import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const DIVIPOLA = '76111' // Guadalajara de Buga
const ZONAS = [
  { code: '01', name: 'Zona 1 - Centro' },
  { code: '02', name: 'Zona 2 - Norte' },
  { code: '03', name: 'Zona 3 - Sur' },
  { code: '99', name: 'Zona Rural (corregimientos)' },
]

async function main() {
  const sa = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }) })
  const tenants = await sa.tenant.findMany({ where: { isActive: true }, select: { slug: true, connectionString: true } })
  await sa.$disconnect()

  for (const t of tenants) {
    const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: decrypt(t.connectionString) }) })
    const muni = await db.municipality.findUnique({ where: { divipola: DIVIPOLA }, select: { id: true } })
    if (!muni) { console.log(`${t.slug}: sin Buga, se omite`); await db.$disconnect(); continue }

    // Crear/asegurar las zonas.
    const zonaIds: string[] = []
    for (const z of ZONAS) {
      const existente = await db.zona.findFirst({ where: { municipalityId: muni.id, code: z.code }, select: { id: true } })
      if (existente) {
        await db.zona.update({ where: { id: existente.id }, data: { name: z.name } })
        zonaIds.push(existente.id)
      } else {
        const creada = await db.zona.create({ data: { municipalityId: muni.id, code: z.code, name: z.name } })
        zonaIds.push(creada.id)
      }
    }

    // Repartir los puestos: los rurales (sin lat/lng o nombres de corregimiento)
    // van a la Zona Rural; el resto se reparte parejo entre las urbanas.
    const puestos = await db.votingStation.findMany({ where: { municipalityId: muni.id }, select: { id: true, name: true, lat: true, lng: true }, orderBy: { name: 'asc' } })
    const zonaRural = zonaIds[zonaIds.length - 1]
    const urbanas = zonaIds.slice(0, -1)
    const esRural = (n: string) => /chambimbal|habana|miraflores|monterrey|nogales|placer|vinculo|frisoles|bancos|quebrada|zanjon|maria|rio |loro|salado|janeiro|magdalena|playa|c[aá]rcel/i.test(n)

    let i = 0
    for (const p of puestos) {
      const zonaId = esRural(p.name) ? zonaRural : urbanas[i++ % urbanas.length]
      await db.votingStation.update({ where: { id: p.id }, data: { zonaId } })
    }

    const conteo = await db.votingStation.groupBy({ by: ['zonaId'], where: { municipalityId: muni.id }, _count: true })
    console.log(`${t.slug}: ${ZONAS.length} zonas · ${puestos.length} puestos repartidos`)
    for (const z of ZONAS) {
      const zid = zonaIds[ZONAS.indexOf(z)]
      const c = conteo.find((x) => x.zonaId === zid)?._count ?? 0
      console.log(`   ${z.code} ${z.name}: ${c}`)
    }
    await db.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
