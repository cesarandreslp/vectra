#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Backfill de fecha de nacimiento para el padrón de PRUEBA: a cada voter sin
 * `birthDate` le pone una fecha aleatoria que cumple la mayoría de edad (18+).
 * Datos ficticios — solo para tener el campo lleno mientras se prueba la
 * elegibilidad y el login de testigos por cédula + fecha.
 *
 * Idempotente: solo toca los que tienen birthDate = null. Corre sobre cada
 * tenant activo.
 *
 * Uso desde packages/db:  tsx src/sembrar-fechas-nacimiento.ts
 */

import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const EDAD_MIN = 18
const EDAD_MAX = 85

/** Fecha aleatoria de nacimiento para alguien con entre EDAD_MIN y EDAD_MAX años. */
function fechaAdultoAlAzar(): Date {
  const hoy  = new Date()
  const edad = EDAD_MIN + Math.floor(Math.random() * (EDAD_MAX - EDAD_MIN + 1))
  const anio = hoy.getFullYear() - edad
  const mes  = Math.floor(Math.random() * 12)          // 0-11
  const dia  = 1 + Math.floor(Math.random() * 28)      // 1-28, evita meses cortos
  return new Date(Date.UTC(anio, mes, dia))
}

async function main() {
  const superadmin = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }) })
  const tenants = await superadmin.tenant.findMany({ where: { isActive: true }, select: { slug: true, connectionString: true } })
  await superadmin.$disconnect()

  for (const t of tenants) {
    const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: decrypt(t.connectionString) }) })
    const pendientes = await db.voter.findMany({ where: { birthDate: null }, select: { id: true } })

    for (const v of pendientes) {
      await db.voter.update({ where: { id: v.id }, data: { birthDate: fechaAdultoAlAzar() } })
    }

    console.log(`  ${t.slug}: ${pendientes.length} fechas sembradas`)
    await db.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
