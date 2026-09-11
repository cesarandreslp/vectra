/**
 * Geocoding con Nominatim (OpenStreetMap) — gratis, sin API key.
 * Política de uso: 1 req/seg y User-Agent identificable. El llamador debe
 * respetar el rate limit (ver geocodificarPendientes). Best-effort: null si falla.
 */

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const q = address.trim()
  if (!q) return null

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'co') // acotar a Colombia mejora la precisión

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Vectra/1.0 (plataforma de campañas electorales)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null

    const data = (await res.json()) as Array<{ lat: string; lon: string }>
    const hit  = data[0]
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
