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
 * "Cll 9sur # 9a-63" no aparece, "Calle 9 Sur 9a-63" sí. Se prueba, en orden:
 * la dirección completa normalizada; solo la vía ("Calle 9 Sur") — la persona
 * queda en su calle —; y si escribieron el barrio después de una coma, el
 * barrio ("San Jeronimo"). Cualquiera es mejor que quedar fuera del mapa.
 */
export function variantesDireccion(address: string): string[] {
  const [principal, ...resto] = address.split(',')
  const barrio = resto.join(' ').replace(/\s+/g, ' ').trim()

  const limpia = principal
    .replace(/\b(?:apto|apt|apartamento|casa|int|interior|piso|torre|bloque|local)\b\.?.*$/i, '') // "Apto 101" no está en el mapa
    .replace(/^\s*(?:cll|clle|cl|calle)\b\.?/i, 'Calle ')
    .replace(/^\s*(?:cra|kra|cr|kr|carrera)\b\.?/i, 'Carrera ')
    .replace(/^\s*(?:tv|tr|transv|transversal)\b\.?/i, 'Transversal ')
    .replace(/^\s*(?:dg|diag|diagonal)\b\.?/i, 'Diagonal ')
    .replace(/^\s*(?:av|avda|avenida)\b\.?/i, 'Avenida ')
    .replace(/(\d+)(?:ra|da|ta|ma|va|na|vo|no|er|°|º)\b/gi, '$1')   // 5ta → 5
    .replace(/(\d+[a-z]?)(sur|norte|bis|este|oeste)\b/gi, '$1 $2')   // 16Sur → 16 Sur, 4Bis → 4 Bis
    .replace(/(\d+[a-z]?)n\b/gi, '$1 Norte')                         // 1N → 1 Norte
    .replace(/\s*-\s*/g, '-')                                        // "13 -68" → "13-68"

  // La vía es lo anterior al "#" / "No"; la placa, lo que sigue.
  const [viaCruda, ...placa] = limpia.split(/#|\bN[oº°]\.?(?=[\s\d])/i)
  let via = viaCruda.replace(/\s+/g, ' ').trim()
  let numero = placa.join(' ').replace(/\s+/g, ' ').trim()
  if (!numero) {
    // Sin "#": "Calle 13 10-49" — la placa es el último "NN-NN".
    const m = via.match(/^(.*\d[a-z]?(?:\s+(?:sur|norte|bis|este|oeste))*)\s+(\d+\s*[a-z]?(?:\s+(?:sur|norte|bis))*-\d+.*)$/i)
    if (m) { via = m[1].trim(); numero = m[2].trim() }
  }

  numero = numero.replace(/[-\s]+$/, '') // lo que dejó "- Apto 101"
  const variantes = [numero ? `${via} ${numero}` : via]
  if (numero && /\d/.test(via)) variantes.push(via)
  if (barrio) variantes.push(barrio)
  return [...new Set(variantes.filter(Boolean))]
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
