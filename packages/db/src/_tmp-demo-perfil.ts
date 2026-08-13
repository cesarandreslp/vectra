#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const modo = process.argv[2] // 'prestar' | 'devolver' | 'estado'

async function main() {
  const superadmin = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }) })
  const t = await superadmin.tenant.findFirst({ where: { isActive: true }, select: { id: true, connectionString: true } })
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: decrypt(t!.connectionString) }) })

  if (modo === 'prestar') {
    const v = await db.voter.findFirst({ where: { tenantId: t!.id }, select: { id: true, name: true } })
    await superadmin.user.update({ where: { email: 'admin@indignos.com' }, data: { voterId: v!.id } })
    console.log('prestado:', v!.name, v!.id)
  } else if (modo === 'devolver') {
    const u = await superadmin.user.findUnique({ where: { email: 'admin@indignos.com' }, select: { voterId: true } })
    if (u?.voterId) {
      await db.perfilSimpatizante.deleteMany({ where: { voterId: u.voterId } })
      await db.voter.update({ where: { id: u.voterId }, data: { esSimpatizante: false } })
    }
    await superadmin.user.update({ where: { email: 'admin@indignos.com' }, data: { voterId: null } })
    console.log('devuelto. perfiles restantes:', await db.perfilSimpatizante.count())
  } else {
    console.log('perfiles:', await db.perfilSimpatizante.count(), '| simpatizantes:', await db.voter.count({ where: { esSimpatizante: true } }))
  }

  await db.$disconnect(); await superadmin.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
