/**
 * Ubicar electores en el mapa (por la dirección que se digitó) sin que nadie
 * tenga que acordarse: corre en segundo plano tras cada alta o cambio de
 * dirección, y el botón del mapa usa lo mismo para los rezagados.
 *
 * Una dirección que el buscador no encuentra se marca (geoIntentadoEn) y no se
 * reintenta hasta que la corrijan: antes esas quedaban de primeras en la fila
 * y el botón respondía "Ubicados 0" para siempre.
 */
import { waitUntil } from '@vercel/functions'
import type { getTenantDb, Prisma } from '@vectra/db'
import { geocodeAddress, zonaDeLimite, dentroDeZona, type ZonaBusqueda } from './geocode'
import { resolverBarrios } from './barrios'
import type { LimiteMapa } from './jurisdiccion'
import { censoEnSegundoPlano } from './censo'

type Db = ReturnType<typeof getTenantDb>

/** Rectángulo del territorio de la campaña (contorno cacheado en TenantConfig). */
export async function zonaDeCampana(db: Db, tenantId: string): Promise<ZonaBusqueda | null> {
  const cfg = await db.tenantConfig.findUnique({ where: { tenantId }, select: { mapaLimite: true } })
  return zonaDeLimite((cfg?.mapaLimite as LimiteMapa | null) ?? null)
}

/**
 * Por ubicar: con dirección, sin intento previo, y sin coordenadas o con
 * coordenadas fuera del territorio (las que dejó la búsqueda sin acotar, p. ej.
 * Buga → Bogotá).
 */
export function wherePorUbicar(tenantId: string, zona: ZonaBusqueda | null): Prisma.VoterWhereInput {
  const fuera: Prisma.VoterWhereInput[] = zona
    ? [{ lat: { lt: zona.sur } }, { lat: { gt: zona.norte } }, { lng: { lt: zona.oeste } }, { lng: { gt: zona.este } }]
    : []
  return { tenantId, address: { not: null }, geoIntentadoEn: null, OR: [{ lat: null }, { lng: null }, ...fuera] }
}

/** Ya se intentó y el buscador no la encontró: hay que corregir la dirección. */
export function whereNoEncontrados(tenantId: string): Prisma.VoterWhereInput {
  return { tenantId, address: { not: null }, lat: null, geoIntentadoEn: { not: null } }
}

/**
 * Ubica pendientes hasta `limite` o hasta agotar `presupuestoMs` (la función
 * serverless tiene tope). Respeta 1 req/s de Nominatim.
 */
export async function ubicarPendientes(
  db: Db, tenantId: string, { limite = 20, presupuestoMs = 40_000 } = {},
): Promise<{ ubicados: number; noEncontrados: number }> {
  const inicio = Date.now()
  const zona   = await zonaDeCampana(db, tenantId)
  const lote   = await db.voter.findMany({ where: wherePorUbicar(tenantId, zona), select: { id: true, address: true }, take: limite })

  let ubicados = 0, noEncontrados = 0
  for (const v of lote) {
    if (Date.now() - inicio > presupuestoMs) break
    let punto = await geocodeAddress(v.address!, zona)
    if (punto && zona && !dentroDeZona(zona, punto.lat, punto.lng)) punto = null

    // Sin ubicación válida se borra la que hubiera: un punto en otra ciudad es peor que ninguno.
    await db.voter.update({
      where: { id: v.id },
      data:  { lat: punto?.lat ?? null, lng: punto?.lng ?? null, geoIntentadoEn: new Date() },
    })
    if (punto) ubicados++
    else noEncontrados++
    await new Promise((r) => setTimeout(r, 1000)) // 1 req/s (política de Nominatim)
  }

  // Ya tienen coordenadas: ubicarlos en su barrio en la misma pasada.
  if (ubicados > 0) await resolverBarrios(db, tenantId)
  return { ubicados, noEncontrados }
}

/** Para altas y cambios de dirección: ubica sin demorar la respuesta. */
export function ubicarEnSegundoPlano(db: Db, tenantId: string): void {
  waitUntil(
    ubicarPendientes(db, tenantId).catch((err) =>
      console.error('[ubicar] lote en segundo plano falló:', err instanceof Error ? err.message : err),
    ),
  )
}

/** Tras crear electores (formulario, QR, Excel): censo y ubicación, los dos en segundo plano. */
export function trasAltaDeElectores(db: Db, tenantId: string): void {
  censoEnSegundoPlano(db, tenantId)
  ubicarEnSegundoPlano(db, tenantId)
}
