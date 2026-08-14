#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Backfill de barrio: a los electores con lat/lng pero sin `neighborhoodId` les
 * asigna el barrio cruzando su punto contra los polígonos cargados. El barrio
 * NO se digita (schema Voter): se deduce. La app ya lo hace tras geocodificar
 * (apps/web/lib/barrios.ts), pero los electores insertados con coordenadas
 * directas — la siembra de testigos — se saltan ese camino y quedan sin barrio,
 * con lo que el filtro por barrio no los ve.
 *
 * Idempotente: solo toca los que tienen neighborhoodId = null. Corre sobre CADA
 * tenant activo, igual que db:geocodificar-puestos-buga.
 *
 * packages/db no depende de apps/web, así que replica puntoEnPoligono como los
 * demás scripts de este paquete.
 *
 * Uso desde packages/db:
 *   tsx src/resolver-barrios.ts --dry   → solo reporta
 *   tsx src/resolver-barrios.ts         → asigna
 */

import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const DRY = process.argv.includes('--dry')

type Punto = [number, number]

function puntoEnPoligono([px, py]: Punto, poligono: Punto[]): boolean {
  let dentro = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i]
    const [xj, yj] = poligono[j]
    const cruza = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (cruza) dentro = !dentro
  }
  return dentro
}

async function main() {
  if (DRY) console.log('MODO DRY — no se escribe nada\n')

  const superadmin = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }) })
  const tenants = await superadmin.tenant.findMany({ where: { isActive: true }, select: { id: true, slug: true, connectionString: true } })
  await superadmin.$disconnect()

  for (const t of tenants) {
    const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: decrypt(t.connectionString) }) })

    const barrios = (await db.neighborhood.findMany({ select: { id: true, boundary: true } }))
      .flatMap((b) => {
        const pol = b.boundary as Punto[] | null
        return pol?.length ? [{ id: b.id, pol }] : []
      })
    if (barrios.length === 0) {
      console.log(`  --  ${t.slug}: sin barrios con polígono, se omite`)
      await db.$disconnect()
      continue
    }

    const pendientes = await db.voter.findMany({
      where:  { tenantId: t.id, neighborhoodId: null, NOT: { lat: null, lng: null } },
      select: { id: true, lat: true, lng: true },
    })

    // Un update por barrio, no uno por elector.
    const porBarrio = new Map<string, string[]>()
    let fuera = 0
    for (const v of pendientes) {
      const barrio = barrios.find((b) => puntoEnPoligono([v.lat!, v.lng!], b.pol))
      if (!barrio) { fuera++; continue }
      porBarrio.set(barrio.id, [...(porBarrio.get(barrio.id) ?? []), v.id])
    }

    let resueltos = 0
    if (!DRY) {
      for (const [neighborhoodId, ids] of porBarrio) {
        const { count } = await db.voter.updateMany({ where: { id: { in: ids } }, data: { neighborhoodId } })
        resueltos += count
      }
    } else {
      resueltos = [...porBarrio.values()].reduce((s, ids) => s + ids.length, 0)
    }

    console.log(`  ${t.slug}: ${pendientes.length} sin barrio · ${resueltos} asignados · ${fuera} fuera de todo polígono${DRY ? '  (dry)' : ''}`)
    await db.$disconnect()
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
