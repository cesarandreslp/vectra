#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Copia el territorio de un municipio de una campaña a otra: zonas electorales,
 * comunas/corregimientos y barrios (con sus polígonos), puestos y mesas.
 *
 * Por qué: cada campaña tiene su BD y arranca solo con DIVIPOLA. El territorio de
 * Buga (polígonos de KML, puestos geocodificados a mano) ya está curado en una
 * campaña; rehacerlo con los scripts de importación pierde ese trabajo.
 *
 * NO copia líderes de comuna/barrio (son electores de la otra campaña).
 * Si el destino ya tiene comunas en ese municipio no hace nada (no duplica).
 *
 * Uso desde packages/db:
 *   tsx src/copiar-territorio.ts <slug-origen> <slug-destino> <divipola>
 *   tsx src/copiar-territorio.ts renequintero iguaran 76111
 */
import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const superadmin = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }) })

async function dbDe(slug: string): Promise<PrismaClient> {
  const t = await superadmin.tenant.findUnique({ where: { slug }, select: { connectionString: true } })
  if (!t) throw new Error(`No existe la campaña "${slug}"`)
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: decrypt(t.connectionString) }) })
}

async function main() {
  const [origenSlug, destinoSlug, divipola] = process.argv.slice(2)
  if (!origenSlug || !destinoSlug || !divipola) {
    console.error('Uso: tsx src/copiar-territorio.ts <slug-origen> <slug-destino> <divipola>')
    process.exit(1)
  }

  const origen  = await dbDe(origenSlug)
  const destino = await dbDe(destinoSlug)

  const muniO = await origen.municipality.findUnique({ where: { divipola } })
  const muniD = await destino.municipality.findUnique({ where: { divipola } })
  if (!muniO || !muniD) throw new Error(`El municipio ${divipola} no está en ambas BD (¿falta DIVIPOLA?)`)

  if (await destino.commune.count({ where: { municipalityId: muniD.id } }) > 0) {
    console.log(`"${destinoSlug}" ya tiene comunas en ${muniD.name}: no se copia nada.`)
    return
  }

  // Zonas (los puestos apuntan a ellas)
  const zonaId = new Map<string, string>()
  for (const z of await origen.zona.findMany({ where: { municipalityId: muniO.id } })) {
    const nueva = await destino.zona.upsert({
      where:  { municipalityId_code: { municipalityId: muniD.id, code: z.code } },
      update: {},
      create: { municipalityId: muniD.id, code: z.code, name: z.name },
    })
    zonaId.set(z.id, nueva.id)
  }

  // Comunas y sus barrios
  let barrios = 0
  const comunas = await origen.commune.findMany({ where: { municipalityId: muniO.id }, include: { neighborhoods: true } })
  for (const c of comunas) {
    await destino.commune.create({
      data: {
        name: c.name, type: c.type, municipalityId: muniD.id, boundary: c.boundary ?? undefined,
        neighborhoods: { create: c.neighborhoods.map((n) => ({ name: n.name, boundary: n.boundary ?? undefined })) },
      },
    })
    barrios += c.neighborhoods.length
  }

  // Puestos y sus mesas
  let mesas = 0
  const puestos = await origen.votingStation.findMany({ where: { municipalityId: muniO.id }, include: { tables: true } })
  for (const p of puestos) {
    await destino.votingStation.create({
      data: {
        name: p.name, address: p.address, municipalityId: muniD.id,
        zonaId: p.zonaId ? zonaId.get(p.zonaId) : null,
        lat: p.lat, lng: p.lng, specialLabel: p.specialLabel,
        tables: { create: p.tables.map((t) => ({ number: t.number, voterCapacity: t.voterCapacity })) },
      },
    })
    mesas += p.tables.length
  }

  console.log(`${origenSlug} → ${destinoSlug} (${muniD.name}): ${zonaId.size} zonas, ${comunas.length} comunas, ${barrios} barrios, ${puestos.length} puestos, ${mesas} mesas.`)
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => process.exit())
