#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Le pone coordenadas a los puestos de votación de Buga resolviendo el NOMBRE
 * de la sede contra Nominatim (OpenStreetMap), en la BD de CADA tenant activo.
 *
 * La Registraduría no publica coordenadas, y la dirección que guardamos es solo
 * "<zona>, Guadalajara de Buga" — geocodificar eso daría 51 puntos encimados en
 * el centroide de cada comuna. Por eso se busca por nombre: casi todas las sedes
 * urbanas son colegios y los puestos rurales llevan el nombre del corregimiento
 * o la vereda, que sí existen en OSM.
 *
 * REGLA: solo se guarda el resultado que cae DENTRO del polígono de la zona a la
 * que la Registraduría asignó ese puesto. Un colegio homónimo en otro municipio,
 * o un match difuso que aterriza en el pueblo equivocado, se descarta y el puesto
 * queda sin coordenadas. Es preferible un mapa incompleto a uno con pines
 * mentirosos: la zona sale de la dirección que escribió import-puestos-buga.
 *
 * Idempotente: solo toca puestos con lat/lng en null, así que volver a correrlo
 * no pisa nada ya ubicado (ni las coordenadas puestas a mano).
 *
 * Uso desde packages/db:
 *   tsx src/geocodificar-puestos-buga.ts --dry   → solo reporta, no escribe
 *   tsx src/geocodificar-puestos-buga.ts         → guarda los match válidos
 */

import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const DIVIPOLA = '76111' // Guadalajara de Buga
const DRY      = process.argv.includes('--dry')

/** Nominatim exige User-Agent identificable y máximo 1 consulta por segundo. */
const USER_AGENT = 'Vectra/1.0 (+https://github.com/cesarandreslp/vectra)'
const PAUSA_MS   = 1100

type Punto = [number, number]

/** Ray casting — misma copia que import-territorio-buga.ts (packages/db no depende de la app). */
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

function bbox(poligonos: Punto[][]): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
  for (const poly of poligonos) {
    for (const [lat, lng] of poly) {
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    }
  }
  return { minLat, maxLat, minLng, maxLng }
}

/**
 * "Ie Narciso Cabal Salcedo" → "Institución Educativa Narciso Cabal Salcedo".
 * Las abreviaturas vienen del nomenclátor de la Registraduría y OSM no las conoce.
 */
function expandir(nombre: string): string {
  return nombre
    .replace(/^Ie\s+/i,   'Institución Educativa ')
    .replace(/^Col\s+/i,  'Colegio ')
    .replace(/^Cdi\s+/i,  'Centro de Desarrollo Infantil ')
    .replace(/^Sede\s+/i, '') // "Sede" solo marca que es anexo de otra institución
    .trim()
}

/**
 * Consultas a intentar, de más específica a más laxa. La segunda quita la
 * primera palabra: los puestos rurales se llaman "<corregimiento> <vereda>"
 * ("Chambimbal Cerro Rico") y en OSM la vereda existe por su nombre solo.
 */
function variantes(nombre: string): string[] {
  const base     = expandir(nombre)
  const palabras = base.split(/\s+/)
  const vs       = [base]
  if (palabras.length >= 3) vs.push(palabras.slice(1).join(' '))
  return vs
}

interface Hit { lat: number; lng: number; etiqueta: string }

async function buscar(consulta: string, caja: ReturnType<typeof bbox>): Promise<Hit[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', `${consulta}, Guadalajara de Buga, Valle del Cauca, Colombia`)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '5')
  url.searchParams.set('countrycodes', 'co')
  // Acotar al municipio ya descarta los homónimos de otros departamentos.
  url.searchParams.set('viewbox', `${caja.minLng},${caja.maxLat},${caja.maxLng},${caja.minLat}`)
  url.searchParams.set('bounded', '1')

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status} para "${consulta}"`)
  const datos = (await res.json()) as { lat: string; lon: string; display_name: string }[]
  return datos.map((d) => ({ lat: Number(d.lat), lng: Number(d.lon), etiqueta: d.display_name }))
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  if (DRY) console.log('MODO DRY — no se escribe nada en la BD\n')

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

    const zonas = (await db.commune.findMany({
      where:  { municipalityId: municipio.id },
      select: { name: true, boundary: true },
    })).filter((z) => z.boundary !== null)
      .map((z) => ({ name: z.name, poly: z.boundary as unknown as Punto[] }))

    if (zonas.length === 0) {
      console.log(`  --  ${t.slug}: sin zonas con polígono, correr db:import-territorio-buga primero`)
      await db.$disconnect()
      continue
    }
    const caja = bbox(zonas.map((z) => z.poly))

    const pendientes = await db.votingStation.findMany({
      where:  { municipalityId: municipio.id, lat: null },
      select: { id: true, name: true, address: true },
      orderBy: { name: 'asc' },
    })
    console.log(`\n=== ${t.slug} — ${pendientes.length} puestos sin coordenadas ===\n`)

    let ubicados = 0
    const fuera: string[] = []
    const sinResultado: string[] = []

    for (const p of pendientes) {
      // La zona es lo primero de la dirección que escribió import-puestos-buga.
      const nombreZona = (p.address ?? '').split(',')[0].trim()
      const zona = zonas.find((z) => z.name.toLowerCase() === nombreZona.toLowerCase())
      if (!zona) {
        sinResultado.push(`${p.name} (zona "${nombreZona}" no encontrada)`)
        continue
      }

      let elegido: Hit | null = null
      let rechazado: Hit | null = null

      for (const consulta of variantes(p.name)) {
        const hits = await buscar(consulta, caja)
        await dormir(PAUSA_MS)
        const dentro = hits.find((h) => puntoEnPoligono([h.lat, h.lng], zona.poly))
        if (dentro) { elegido = dentro; break }
        if (!rechazado && hits.length > 0) rechazado = hits[0]
      }

      if (elegido) {
        console.log(`  OK   ${p.name.padEnd(38)} → ${elegido.lat.toFixed(5)}, ${elegido.lng.toFixed(5)}  [${zona.name}]`)
        if (!DRY) await db.votingStation.update({ where: { id: p.id }, data: { lat: elegido.lat, lng: elegido.lng } })
        ubicados++
      } else if (rechazado) {
        console.log(`  ~    ${p.name.padEnd(38)} → descartado, cae fuera de ${zona.name}`)
        fuera.push(`${p.name} (${zona.name})`)
      } else {
        console.log(`  --   ${p.name.padEnd(38)} → sin resultado en OSM`)
        sinResultado.push(p.name)
      }
    }

    console.log(
      `\n  ${t.slug}: ${ubicados} ubicados · ${fuera.length} descartados por caer fuera de su zona · ` +
      `${sinResultado.length} sin resultado${DRY ? '  (dry, no se guardó)' : ''}`,
    )
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
