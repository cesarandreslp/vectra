#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Importa el directorio real de puestos de votación y mesas de Guadalajara de
 * Buga, en la BD de CADA tenant activo que tenga el municipio.
 *
 * Fuente: nomenclátor público de la Registraduría (Presidencia 2026, segunda
 * vuelta), que trae la jerarquía completa DEPARTAMENTO → MUNICIPIO → ZONA →
 * PUESTO → MESA:
 *   https://resultadosprecpresidente2026-2v.registraduria.gov.co/json/nomenclator.json
 *
 * El script LO DESCARGA. Antes esperaba un JSON armado a mano que nunca estuvo
 * en el repo, así que no se podía correr; y escribía en la DATABASE_URL suelta,
 * que en multi-tenant no es la BD de ninguna campaña.
 *
 * Zonas de Buga: 01-06 = comunas urbanas, 98 = puesto especial "CARCEL",
 * 99 = puestos rurales de los corregimientos. La zona sirve para redactar la
 * dirección del puesto: VotingStation cuelga del municipio, no de la comuna.
 *
 * Idempotente: identifica por (municipio, nombre) y solo agrega las mesas que
 * falten, así que volver a correrlo no duplica ni pisa capacidades editadas.
 *
 * Uso desde packages/db:  tsx src/import-puestos-buga.ts
 */

import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const NOMENCLATOR = 'https://resultadosprecpresidente2026-2v.registraduria.gov.co/json/nomenclator.json'
const COD_BUGA    = '31022' // código de municipio de la Registraduría (≠ DIVIPOLA)
const DIVIPOLA    = '76111' // Guadalajara de Buga, para encontrarlo en nuestra DB

/** Cárcel de Buga: la Registraduría no da coordenadas y el puesto cae en un hueco del KML. */
const CARCEL = { lat: 3.92211, lng: -76.29657, direccion: 'Calle 15 # 8-40, Buga' }

/** Nodo del nomenclátor. `l` = nivel (4 zona, 6 puesto), `m` = mesas, `h` = hijos. */
interface Ambito {
  i: number
  n: string
  c: string
  l: number
  m: number
  h?: { l: number; p: number[] }[]
}

interface Puesto { nombre: string; mesas: number; zona: string }

function normalizar(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // saca tildes
    .replace(/^(el|la|los)\s+/, '')
    .replace(/\s+/g, '') // ignora espacios ("Quebrada Seca" vs "QUEBRADASECA")
    .trim()
}

function tituloCase(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

function hijos(nodo: Ambito, nivel: number): number[] {
  return nodo.h?.find((h) => h.l === nivel)?.p ?? []
}

/** Puestos de Buga con su número de mesas y su zona, desde el nomenclátor. */
async function descargarPuestos(): Promise<Puesto[]> {
  const res = await fetch(NOMENCLATOR)
  if (!res.ok) throw new Error(`No se pudo descargar el nomenclátor: HTTP ${res.status}`)
  const data = (await res.json()) as { amb: { ambitos: Ambito[] }[] }
  const ambitos = data.amb[0].ambitos

  const municipio = ambitos.find((a) => a.l === 3 && a.c === COD_BUGA)
  if (!municipio) throw new Error(`No se encontró el municipio ${COD_BUGA} en el nomenclátor.`)

  const puestos: Puesto[] = []
  for (const zi of hijos(municipio, 4)) {
    const zona = ambitos[zi]
    for (const pi of hijos(zona, 6)) {
      const p = ambitos[pi]
      puestos.push({ nombre: p.n, mesas: p.m, zona: zona.c.slice(-2) })
    }
  }
  return puestos
}

async function main() {
  const puestos = await descargarPuestos()
  const totalMesas = puestos.reduce((n, p) => n + p.mesas, 0)
  console.log(`Registraduría: ${puestos.length} puestos, ${totalMesas} mesas en Buga\n`)

  const superadmin = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }),
  })
  const tenants = await superadmin.tenant.findMany({
    where:  { isActive: true },
    select: { slug: true, connectionString: true },
  })
  await superadmin.$disconnect()

  for (const t of tenants) {
    const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: decrypt(t.connectionString) }) })
    const municipio = await db.municipality.findUnique({ where: { divipola: DIVIPOLA } })
    if (!municipio) {
      console.log(`  --  ${t.slug}: sin el municipio ${DIVIPOLA}, se omite`)
      await db.$disconnect()
      continue
    }

    const zonas = await db.commune.findMany({ where: { municipalityId: municipio.id } })
    const comunas        = zonas.filter((z) => z.type === 'COMUNA')
    const corregimientos = zonas.filter((z) => z.type === 'CORREGIMIENTO')

    let creados = 0, actualizados = 0, mesasCreadas = 0
    const sinZona: string[] = []

    for (const p of puestos) {
      const esCarcel = p.zona === '98'
      // Solo para la dirección: VotingStation no tiene relación con Commune.
      const zona = esCarcel ? undefined
        : p.zona === '99'
          ? corregimientos.find((c) => normalizar(p.nombre).includes(normalizar(c.name)))
          : comunas.find((c) => c.name === `Comuna ${parseInt(p.zona, 10)}`)

      if (!zona && !esCarcel) {
        sinZona.push(`${p.nombre} (zona ${p.zona})`)
        continue
      }

      const nombre    = esCarcel ? 'Cárcel de Buga' : tituloCase(p.nombre)
      const direccion = esCarcel ? CARCEL.direccion : `${zona!.name}, Guadalajara de Buga, Valle del Cauca`

      const existente = await db.votingStation.findFirst({
        where: { municipalityId: municipio.id, name: { equals: nombre, mode: 'insensitive' } },
      })
      const estacion = existente
        ? (actualizados++, await db.votingStation.update({
            where: { id: existente.id },
            data:  { address: direccion, ...(esCarcel ? { lat: CARCEL.lat, lng: CARCEL.lng, specialLabel: 'Cárcel' } : {}) },
          }))
        : (creados++, await db.votingStation.create({
            data: {
              name: nombre, address: direccion, municipalityId: municipio.id,
              ...(esCarcel ? { lat: CARCEL.lat, lng: CARCEL.lng, specialLabel: 'Cárcel' } : {}),
            },
          }))

      // Solo se agregan las que falten: no se tocan las mesas ya existentes,
      // que pueden tener voterCapacity ajustada a mano.
      const yaHay = await db.votingTable.count({ where: { stationId: estacion.id } })
      for (let n = yaHay + 1; n <= p.mesas; n++) {
        await db.votingTable.create({ data: { number: n, stationId: estacion.id, voterCapacity: 350 } })
        mesasCreadas++
      }
    }

    console.log(`  OK  ${t.slug}: puestos ${creados} creados / ${actualizados} actualizados · ${mesasCreadas} mesas creadas`)
    if (sinZona.length > 0) {
      console.log(`      ⚠ sin comuna/corregimiento que los ubique, NO creados (${sinZona.length}): ${sinZona.join(', ')}`)
    }
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
