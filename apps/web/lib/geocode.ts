/**
 * Geocoding con Nominatim (OpenStreetMap) — gratis, sin API key.
 * Política de uso: 1 req/seg y User-Agent identificable. El llamador debe
 * respetar el rate limit (ver geocodificarPendientes). Best-effort: null si falla.
 */

import type { LimiteMapa } from './jurisdiccion'

/** Rectángulo (y nombre) del territorio de la campaña donde buscar direcciones. */
export interface ZonaBusqueda { nombre: string; sur: number; norte: number; oeste: number; este: number }

/** Rectángulo que encierra el contorno de la jurisdicción (ver getLimiteMapa). */
export function zonaDeLimite(limite: LimiteMapa | null): ZonaBusqueda | null {
  const puntos = limite?.anillos.flat() ?? []
  if (puntos.length === 0) return null
  const lats = puntos.map(([lat]) => lat)
  const lngs = puntos.map(([, lng]) => lng)
  return { nombre: limite!.nombre, sur: Math.min(...lats), norte: Math.max(...lats), oeste: Math.min(...lngs), este: Math.max(...lngs) }
}

export function dentroDeZona(zona: ZonaBusqueda, lat: number, lng: number): boolean {
  return lat >= zona.sur && lat <= zona.norte && lng >= zona.oeste && lng <= zona.este
}

/**
 * Con `zona`, la búsqueda queda encerrada en el territorio de la campaña. Sin
 * eso una dirección colombiana típica ("Carrera 8 # 11-43") es ambigua y
 * Nominatim devuelve la primera Carrera 8 del país: electores de Buga caían en
 * Bogotá, fuera del mapa acotado, y no se veían.
 */
export async function geocodeAddress(address: string, zona?: ZonaBusqueda | null): Promise<{ lat: number; lng: number } | null> {
  const consultas = variantesDireccion(address)
  for (const [i, q] of consultas.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1000)) // 1 req/s (política de Nominatim)
    const hit = await buscarPunto(zona ? `${q}, ${zona.nombre}` : q, zona)
    if (hit) return hit
  }
  return null
}

/**
 * Cómo se escribe una dirección en Colombia vs. lo que entiende Nominatim:
 * "calle 5ta sur No 15b-61" no aparece, "Calle 5 Sur 15b-61" sí. Primero la
 * dirección normalizada; si el número exacto no está en el mapa, solo la vía
 * ("Calle 5 Sur"): la persona queda en su calle, que es mejor que fuera del mapa.
 */
export function variantesDireccion(address: string): string[] {
  const normal = address
    .replace(/(\d+)(?:ra|da|ta|ma|va|na|vo|no|er|°|º)\b/gi, '$1') // 5ta → 5, 1ra → 1
    .replace(/\s*(?:#|\bN[oº°]\.?(?=[\s\d])|\bnum(?:ero)?\.?(?=[\s\d]))\s*/gi, ' ')     // "No 15b-61" / "# 15b-61" → " 15b-61"
    .replace(/\s+/g, ' ')
    .trim()
  if (!normal) return []
  // La vía es todo lo anterior al número de placa ("15b-61").
  const via = normal.replace(/\s+\d+\s*[a-z]?\s*-\s*\d+.*$/i, '').trim()
  return via && via !== normal && /\d/.test(via) ? [normal, via] : [normal]
}

async function buscarPunto(q: string, zona?: ZonaBusqueda | null): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'co') // acotar a Colombia mejora la precisión
    if (zona) {
      url.searchParams.set('viewbox', `${zona.oeste},${zona.norte},${zona.este},${zona.sur}`)
      url.searchParams.set('bounded', '1')
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Vectra/1.0 (plataforma de campañas electorales)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null

    const hit = ((await res.json()) as Array<{ lat: string; lon: string }>)[0]
    if (!hit) return null

    const lat = parseFloat(hit.lat)
    const lng = parseFloat(hit.lon)
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
  } catch {
    return null
  }
}

/**
 * Contorno administrativo (municipio, departamento o país) desde Nominatim,
 * simplificado con `umbral` (grados) para que pese poco. Devuelve solo los
 * anillos exteriores en [lat, lng]: los huecos no importan para acotar un mapa.
 * Mismo uso responsable que geocodeAddress: el llamador lo cachea. Best-effort.
 */
export async function buscarContorno(consulta: string, umbral: number): Promise<[number, number][][] | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', consulta)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '5')
    url.searchParams.set('countrycodes', 'co')
    url.searchParams.set('polygon_geojson', '1')
    url.searchParams.set('polygon_threshold', String(umbral))

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Vectra/1.0 (plataforma de campañas electorales)' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null

    const data = (await res.json()) as Array<{ class: string; geojson?: { type: string; coordinates: unknown } }>
    // La búsqueda también trae el punto del casco urbano: sirve solo el límite administrativo.
    const hit = data.find((d) => d.class === 'boundary' && (d.geojson?.type === 'Polygon' || d.geojson?.type === 'MultiPolygon'))
    if (!hit?.geojson) return null

    const poligonos = (hit.geojson.type === 'Polygon' ? [hit.geojson.coordinates] : hit.geojson.coordinates) as number[][][][]
    return poligonos.map((p) => p[0].map(([lng, lat]) => [lat, lng] as [number, number]))
  } catch {
    return null
  }
}
