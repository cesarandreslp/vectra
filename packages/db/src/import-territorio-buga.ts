#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Siembra el territorio de Guadalajara de Buga con polígonos reales, en la BD
 * de CADA tenant activo que tenga el municipio: 6 comunas, 18 corregimientos
 * y 54 barrios.
 *
 * Fuente: KML de la Alcaldía de Buga ("División Política y Administrativa
 * Zona Urbana Municipio De Guadalajara De Buga"), carpetas "Comunas",
 * "Corregimientos Zona rural" y "Barrios":
 *   https://www.google.com/maps/d/kml?mid=1RoVWEf3WFjx-J5z-GXcoGyQ3gwwwg3yg&forcekml=1
 *
 * Cada barrio se cuelga de la comuna/corregimiento que REALMENTE lo contiene,
 * por punto-en-polígono sobre su centroide, no emparejando nombres a mano.
 *
 * Por qué otro script si ya existen import-comunas-boundary y
 * import-corregimientos-y-barrios: aquellos escriben en la DATABASE_URL suelta
 * y el de comunas solo ACTUALIZA el boundary de comunas que ya existan. En
 * multi-tenant cada campaña tiene su propia BD y arranca sin ninguna comuna,
 * así que no había forma de sembrarlas. Este recorre los tenants y las crea.
 *
 * Idempotente: identifica por (municipio, nombre) y actualiza en vez de
 * duplicar. No borra nada, así que un barrio agregado a mano en Territorio
 * sobrevive a volver a correrlo.
 *
 * Uso desde packages/db:
 *   tsx src/import-territorio-buga.ts [ruta-al-kml]
 * Sin argumento descarga el KML de la URL de arriba.
 */

import { readFileSync } from 'fs'
import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const KML_URL   = 'https://www.google.com/maps/d/kml?mid=1RoVWEf3WFjx-J5z-GXcoGyQ3gwwwg3yg&forcekml=1'
const DIVIPOLA  = '76111' // Guadalajara de Buga

type Punto = [number, number]
interface Zona { name: string; type: 'COMUNA' | 'CORREGIMIENTO'; boundary: Punto[] }

function tituloCase(s: string): string {
  return s.trim().replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

/**
 * Ray casting. Copiado a propósito en vez de importarlo de apps/web/lib/geometry:
 * packages/db no depende de la app, y los otros scripts de importación llevan la
 * misma copia.
 */
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

function centroide(poligono: Punto[]): Punto {
  const lat = poligono.reduce((s, p) => s + p[0], 0) / poligono.length
  const lng = poligono.reduce((s, p) => s + p[1], 0) / poligono.length
  return [lat, lng]
}

/** Placemarks con polígono de una carpeta del KML, en orden [lat,lng] (el de Leaflet). */
function extraerFolder(kml: string, nombreFolder: string): { name: string; boundary: Punto[] }[] {
  const escaped = nombreFolder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = kml.match(new RegExp(`<Folder>\\s*<name>${escaped}</name>([\\s\\S]*?)</Folder>`))
  if (!m) throw new Error(`No se encontró la carpeta "${nombreFolder}" en el KML.`)

  return [...m[1].matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)]
    .map(([, pm]) => {
      const name      = (pm.match(/<name>([\s\S]*?)<\/name>/) ?? [, ''])[1].trim()
      const coordsRaw = (pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/) ?? [, ''])[1].trim()
      // KML viene "lng,lat,alt lng,lat,alt …"; Leaflet quiere [lat,lng].
      const boundary: Punto[] = coordsRaw
        ? coordsRaw.split(/\s+/).map((triple) => {
            const [lng, lat] = triple.split(',').map(Number)
            return [lat, lng] as Punto
          })
        : []
      return { name, boundary }
    })
    .filter((p) => p.name && p.boundary.length > 0)
}

async function leerKml(): Promise<string> {
  const ruta = process.argv[2]
  if (ruta) return readFileSync(ruta, 'utf-8')
  const res = await fetch(KML_URL)
  if (!res.ok) throw new Error(`No se pudo descargar el KML: HTTP ${res.status}`)
  return res.text()
}

async function main() {
  const kml = await leerKml()

  const zonas: Zona[] = [
    ...extraerFolder(kml, 'Comunas')
      .map((c) => ({ name: tituloCase(c.name), type: 'COMUNA' as const, boundary: c.boundary })),
    ...extraerFolder(kml, 'Corregimientos Zona rural')
      // "Corregimiento de chambimbal" → "Chambimbal": el tipo ya dice que es
      // corregimiento, repetirlo en el nombre solo ensucia la lista.
      .map((c) => ({
        name:     tituloCase(c.name.replace(/^Corregimiento\s+(de\s+|el\s+|la\s+)?/i, '')),
        type:     'CORREGIMIENTO' as const,
        boundary: c.boundary,
      })),
  ]
  const barrios = extraerFolder(kml, 'Barrios')
  console.log(
    `KML: ${zonas.filter((z) => z.type === 'COMUNA').length} comunas, ` +
    `${zonas.filter((z) => z.type === 'CORREGIMIENTO').length} corregimientos, ` +
    `${barrios.length} barrios\n`,
  )

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

    let creadas = 0, actualizadas = 0
    for (const z of zonas) {
      const existente = await db.commune.findFirst({
        where: { municipalityId: municipio.id, name: { equals: z.name, mode: 'insensitive' } },
      })
      if (existente) {
        await db.commune.update({
          where: { id: existente.id },
          data:  { type: z.type, boundary: z.boundary },
        })
        actualizadas++
      } else {
        await db.commune.create({
          data: { name: z.name, type: z.type, municipalityId: municipio.id, boundary: z.boundary },
        })
        creadas++
      }
    }
    // Barrios: se cuelgan de la zona que contiene su centroide. Se releen las
    // zonas de la BD (no del KML) porque hace falta su id, y ya tienen boundary.
    const zonasBd = await db.commune.findMany({
      where:  { municipalityId: municipio.id },
      select: { id: true, name: true, boundary: true },
    })

    const conLimites = zonasBd.filter((z) => z.boundary !== null)

    let barriosCreados = 0, barriosActualizados = 0
    const sinZona: string[] = []
    const porMayoria: string[] = []
    for (const b of barrios) {
      const centro = centroide(b.boundary)
      let contenedor = conLimites.find((z) => puntoEnPoligono(centro, z.boundary as unknown as Punto[]))

      // Los polígonos del KML no teselan perfectamente: un barrio a caballo
      // entre dos zonas puede tener el centroide en el hueco entre ambas. Ahí
      // se decide por cuál zona cubre más vértices del barrio, en vez de
      // descartarlo. Es un desempate, no una certeza — por eso se avisa.
      if (!contenedor) {
        let mejor = 0
        for (const z of conLimites) {
          const poly = z.boundary as unknown as Punto[]
          const dentro = b.boundary.filter((p) => puntoEnPoligono(p, poly)).length
          if (dentro > mejor) { mejor = dentro; contenedor = z }
        }
        if (contenedor) porMayoria.push(`${b.name} → ${contenedor.name}`)
      }

      if (!contenedor) {
        sinZona.push(b.name)
        continue
      }

      const nombre = tituloCase(b.name)
      const existente = await db.neighborhood.findFirst({
        where: { commune: { municipalityId: municipio.id }, name: { equals: nombre, mode: 'insensitive' } },
      })
      if (existente) {
        await db.neighborhood.update({
          where: { id: existente.id },
          data:  { communeId: contenedor.id, boundary: b.boundary },
        })
        barriosActualizados++
      } else {
        await db.neighborhood.create({
          data: { name: nombre, communeId: contenedor.id, boundary: b.boundary },
        })
        barriosCreados++
      }
    }

    console.log(
      `  OK  ${t.slug}: zonas ${creadas} creadas / ${actualizadas} actualizadas · ` +
      `barrios ${barriosCreados} creados / ${barriosActualizados} actualizados`,
    )
    if (porMayoria.length > 0) {
      console.log(`      ~ a caballo entre dos zonas, asignados por mayoría de vértices: ${porMayoria.join(', ')}`)
    }
    if (sinZona.length > 0) {
      // No se inventa una zona: se dicen los nombres para poder revisarlos.
      console.log(`      ⚠ sin zona que los contenga, NO creados (${sinZona.length}): ${sinZona.join(', ')}`)
    }
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
