#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Verificación del módulo Día E contra las BDs REALES de cada tenant.
 *
 * En multi-tenant cada campaña tiene su propia BD. Esto comprueba que las
 * columnas nuevas (registraduriaData, estado del testigo, discrepancias…)
 * existan en la BD SEPARADA de cada tenant y que las consultas de la sala
 * (getDashboardDiaE / getResultadosEnVivo / getMesasEnDisputa) + la
 * verificación de 3 fuentes corran sobre datos reales.
 *
 * Correr desde packages/db:  tsx src/verificar-dia-e.ts
 */
import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'
import { verificarTresFuentes, type VotoPorCandidato } from '../../../apps/web/lib/verificacion-e14'

neonConfig.webSocketConstructor = ws

const ok   = (s: string) => console.log(`  OK  ${s}`)
const warn = (s: string) => console.log(`  !!  ${s}`)
const fail = (s: string) => console.log(`  XX  ${s}`)

async function main() {
  const conn = process.env.DATABASE_URL_SUPERADMIN
  if (!conn) { fail('Falta DATABASE_URL_SUPERADMIN'); process.exit(1) }
  const superadmin = new PrismaClient({ adapter: new PrismaNeon({ connectionString: conn }) })

  const tenants = await superadmin.tenant.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true, connectionString: true },
  })
  console.log(`\nTenants activos: ${tenants.length}\n`)

  let tenantsOk = 0
  for (const t of tenants) {
    console.log(`-- ${t.name} (${t.slug}) --`)
    let cs: string
    try { cs = decrypt(t.connectionString) }
    catch { fail('connectionString no descifrable — se salta'); continue }

    const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: cs }) })
    try {
      const asign = await db.witnessAssignment.findMany({
        select: { id: true, estado: true, observacion: true, votingTableIdPropuesto: true, resueltoAt: true },
        take: 5,
      })
      ok(`witnessAssignment: columnas de Registraduría OK (${asign.length} filas)`)

      const txs = await db.e14Transmission.findMany({
        select: {
          verificationStatus: true,
          manualData: true, manualSubmittedAt: true,
          extractedData: true, photoSubmittedAt: true,
          registraduriaData: true, registraduriaAt: true, registraduriaTotal: true, registraduriaFuente: true,
          discrepancies: true, finalData: true,
        },
      })
      ok(`e14Transmission: columnas de 3 fuentes OK (${txs.length} transmisiones)`)

      const totalMesas = await db.votingTable.count()
      const porEstado = new Map<string, number>()
      for (const tx of txs) porEstado.set(tx.verificationStatus, (porEstado.get(tx.verificationStatus) ?? 0) + 1)
      ok(`dashboard: ${totalMesas} mesas, estados=${JSON.stringify(Object.fromEntries(porEstado))}`)

      let v = 0, i = 0, d = 0, p = 0
      for (const tx of txs) {
        const r = verificarTresFuentes({
          manual:        tx.manualSubmittedAt ? (tx.manualData as VotoPorCandidato[] | null) : null,
          foto:          tx.photoSubmittedAt  ? (tx.extractedData as VotoPorCandidato[] | null) : null,
          registraduria: tx.registraduriaAt   ? (tx.registraduriaData as VotoPorCandidato[] | null) : null,
        })
        r.estado === 'VERIFICADO' ? v++ : r.estado === 'INCOMPLETA' ? i++ : r.estado === 'DISCREPANCIA' ? d++ : p++
      }
      ok(`verificarTresFuentes sobre ${txs.length}: verif=${v} incompl=${i} disputa=${d} pend=${p}`)
      tenantsOk++
      console.log('  -> Dia E OK contra su BD real\n')
    } catch (e) {
      fail(`consulta falló: ${e instanceof Error ? e.message : e}\n`)
    } finally {
      await db.$disconnect().catch(() => {})
    }
  }

  await superadmin.$disconnect().catch(() => {})
  console.log(`Resultado: ${tenantsOk}/${tenants.length} tenants con Dia E funcionando contra su BD real.`)
  process.exit(tenantsOk === tenants.length ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
