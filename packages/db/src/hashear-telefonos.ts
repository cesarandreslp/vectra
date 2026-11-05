#!/usr/bin/env tsx
/**
 * Llena Voter.telefonoHash en los electores que tienen celular y todavía no lo
 * tienen (los que entraron antes de existir el campo, o por la siembra).
 * Idempotente. Correr desde packages/db:  tsx src/hashear-telefonos.ts
 */
import { config } from 'dotenv'
config({ path: '../../.env' })

import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'
// La misma normalización que usa la app: un hash distinto no cruzaría nunca.
import { hashTelefono } from '../../../apps/web/lib/contacto-calle'

neonConfig.webSocketConstructor = ws

async function main() {
  const superadmin = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }) })
  const tenants = await superadmin.tenant.findMany({ where: { isActive: true }, select: { slug: true, connectionString: true } })
  await superadmin.$disconnect()

  for (const t of tenants) {
    const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: decrypt(t.connectionString) }) })
    const faltan = await db.voter.findMany({ where: { phone: { not: null }, telefonoHash: null }, select: { id: true, phone: true } })
    let hechos = 0, ilegibles = 0
    for (const v of faltan) {
      let plano: string
      try { plano = decrypt(v.phone!) } catch { ilegibles++; continue }
      const telefonoHash = hashTelefono(plano)
      if (!telefonoHash) continue
      await db.voter.update({ where: { id: v.id }, data: { telefonoHash } })
      hechos++
    }
    console.log(`  ${t.slug}: ${hechos} de ${faltan.length}${ilegibles ? ` (${ilegibles} sin descifrar)` : ''}`)
    await db.$disconnect()
  }
}

main()
