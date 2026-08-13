/**
 * Resuelve en qué barrio vive cada elector cruzando sus coordenadas contra los
 * polígonos ya cargados. El barrio NO se digita en ningún formulario: si hay
 * dirección geocodificada y polígonos, el dato se deduce.
 */

import { getTenantDb } from '@vectra/db'
import { puntoEnPoligono } from './geometry'

type Db = ReturnType<typeof getTenantDb>

export interface ResultadoResolucion {
  /** Electores a los que se les asignó barrio en esta corrida. */
  resueltos: number
  /** Tienen coordenadas pero cayeron fuera de todos los polígonos cargados. */
  fueraDePoligono: number
}

/**
 * Asigna `neighborhoodId` a los electores que tienen lat/lng y todavía no lo
 * tienen. Es idempotente: correrla dos veces no cambia nada la segunda.
 *
 * Devuelve cuántos quedaron fuera de todo polígono — importa reportarlo, no
 * tragárselo: al importar un padrón nuevo esos son los que nadie va a ver en
 * los filtros por barrio.
 */
export async function resolverBarrios(db: Db, tenantId: string): Promise<ResultadoResolucion> {
  const barrios = (await db.neighborhood.findMany({ select: { id: true, boundary: true } }))
    .flatMap((b) => {
      const poligono = b.boundary as [number, number][] | null
      return poligono?.length ? [{ id: b.id, poligono }] : []
    })
  if (barrios.length === 0) return { resueltos: 0, fueraDePoligono: 0 }

  const pendientes = await db.voter.findMany({
    where:  { tenantId, neighborhoodId: null, NOT: { lat: null, lng: null } },
    select: { id: true, lat: true, lng: true },
  })

  // Un update por barrio en vez de uno por elector: con un padrón grande la
  // diferencia es de miles de idas a la DB a unas pocas decenas.
  const porBarrio = new Map<string, string[]>()
  let fueraDePoligono = 0

  for (const v of pendientes) {
    const barrio = barrios.find((b) => puntoEnPoligono([v.lat!, v.lng!], b.poligono))
    if (!barrio) { fueraDePoligono++; continue }
    porBarrio.set(barrio.id, [...(porBarrio.get(barrio.id) ?? []), v.id])
  }

  let resueltos = 0
  for (const [neighborhoodId, ids] of porBarrio) {
    const { count } = await db.voter.updateMany({ where: { id: { in: ids } }, data: { neighborhoodId } })
    resueltos += count
  }

  return { resueltos, fueraDePoligono }
}
