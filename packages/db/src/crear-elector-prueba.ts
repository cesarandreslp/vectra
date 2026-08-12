#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Crea (o actualiza) UN elector de PRUEBA con cédula y teléfono ficticios
 * CONOCIDOS, para poder probar el login de electores (PWA). SOLO test.
 * No lee ni descifra datos existentes: escribe valores inventados.
 *
 * Correr desde packages/db:  tsx src/crear-elector-prueba.ts
 */
import { createHash } from 'crypto'
import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { encrypt, decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const CEDULA   = '1099999001'          // ficticia
const TELEFONO = '3001112233'          // ficticio
const NOMBRE   = 'Elector de Prueba'

async function main() {
  const superadmin = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }) })
  const t = await superadmin.tenant.findFirst({ where: { isActive: true }, select: { id: true, slug: true, name: true, connectionString: true } })
  if (!t) { console.log('No hay tenant activo'); process.exit(1) }

  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: decrypt(t.connectionString) }) })
  const cedulaHash = createHash('sha256').update(CEDULA.trim()).digest('hex')

  const existente = await db.voter.findFirst({ where: { tenantId: t.id, cedulaHash }, select: { id: true } })
  if (existente) {
    await db.voter.update({ where: { id: existente.id }, data: { phone: encrypt(TELEFONO), name: NOMBRE } })
    console.log('\nElector de prueba ya existía — teléfono/nombre actualizados.')
  } else {
    await db.voter.create({
      data: { tenantId: t.id, name: NOMBRE, cedula: encrypt(CEDULA), cedulaHash, phone: encrypt(TELEFONO) },
    })
    console.log('\nElector de prueba creado.')
  }

  console.log('\n─ Login de electores (PWA) ─')
  console.log(`  Campaña (slug): ${t.slug}`)
  console.log(`  Cédula:         ${CEDULA}`)
  console.log(`  Teléfono:       ${TELEFONO}`)
  console.log(`  URL local:      http://localhost:3000/electores/login`)
  console.log(`  URL prod:       https://vectra-web.vercel.app/electores/login`)
  console.log(`  (tras entrar cae en /pwa)\n`)

  await db.$disconnect(); await superadmin.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
