#!/usr/bin/env tsx
/**
 * Datos de PRUEBA (borrar): carga como rivales los 10 candidatos que aparecen
 * en docs/e14.webp, con su número de tarjetón, para poder demostrar el camino
 * foto → IA → consenso → verificación contra un acta real.
 *
 *   cargar:  tsx src/_seed-tarjeton-demo.ts
 *   quitar:  tsx src/_seed-tarjeton-demo.ts borrar
 */
import { config } from 'dotenv'
config({ path: '../../.env' })

import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

/** Tal como los leyeron las tres IAs en docs/e14.webp. */
const TARJETON = [
  { order: 1,  name: 'Diana Nelly Fuentes Meneses' },
  { order: 2,  name: 'Juan Francisco Salamanca Anaya' },
  { order: 3,  name: 'Gustavo Adolfo Martinez Arcos' },
  { order: 4,  name: 'Maria Fernanda Varona Taborda' },
  { order: 5,  name: 'Pablo Andres Parra Solano' },
  { order: 6,  name: 'Oyther Manuel Candelo Riascos' },
  { order: 7,  name: 'Jorge Eliecer Constain Dorado' },
  { order: 8,  name: 'Francisco Javier Pantoja Pantoja' },
  { order: 9,  name: 'Jose Luis Diago Franco' },
  { order: 10, name: 'Juan Carlos Muñoz Bravo' },
]

async function main() {
  const borrar = process.argv[2] === 'borrar'

  const superadmin = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }),
  })
  const tenant = await superadmin.tenant.findFirst({
    where: { isActive: true, slug: 'indignos' }, select: { id: true, connectionString: true },
  })
  await superadmin.$disconnect()
  if (!tenant) throw new Error('no hay tenant indignos')

  const db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: decrypt(tenant.connectionString) }),
  })

  if (borrar) {
    const { count } = await db.candidate.deleteMany({
      where: { tenantId: tenant.id, isOwn: false, name: { in: TARJETON.map(c => c.name) } },
    })
    console.log(`borrados ${count} candidatos de prueba`)
  } else {
    let creados = 0, actualizados = 0
    for (const c of TARJETON) {
      const existe = await db.candidate.findFirst({
        where: { tenantId: tenant.id, name: c.name }, select: { id: true },
      })
      if (existe) {
        await db.candidate.update({ where: { id: existe.id }, data: { order: c.order } })
        actualizados++
      } else {
        await db.candidate.create({
          data: { tenantId: tenant.id, name: c.name, order: c.order, isOwn: false },
        })
        creados++
      }
    }
    console.log(`tarjetón de prueba: ${creados} creados, ${actualizados} actualizados`)
  }

  const todos = await db.candidate.findMany({
    where: { tenantId: tenant.id }, orderBy: { order: 'asc' },
    select: { name: true, order: true, isOwn: true },
  })
  console.log(`\ntarjetón del tenant (${todos.length}):`)
  todos.forEach(c => console.log(`  Nº${String(c.order).padStart(2)} ${c.name}${c.isOwn ? '  ← NUESTRO' : ''}`))

  await db.$disconnect()
}
main()
