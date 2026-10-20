import type { BarrioGeo, VoterGeo } from '../actions'
import { intensidadDeEstado, COLOR_TEMPERATURA, ETIQUETA_TEMPERATURA, type Temperatura } from '@/lib/temperatura'

/**
 * Mapa de calor por barrio: cada barrio toma el compromiso PROMEDIO de su gente
 * (no la suma, que pintaba de rojo cualquier zona con mucha gente aunque nadie
 * estuviera comprometido), y los barrios donde la campaña no tiene a nadie
 * salen como "sin presencia": la zona fría que más importa.
 */
export type TemperaturaBarrio = Temperatura | 'vacio'

export const COLOR_VACIO = '#ffffff'
export const ETIQUETA_VACIO = 'Sin presencia'

/** Promedio de intensidad → frío / tibio / caliente (cortes entre los valores de cada estado). */
function temperaturaDePromedio(promedio: number): Temperatura {
  if (promedio < 0.475) return 'frio'
  if (promedio < 0.725) return 'tibio'
  return 'caliente'
}

export interface CalorDeBarrio {
  barrio:      BarrioGeo
  electores:   number
  temperatura: TemperaturaBarrio
}

export function calorPorBarrio(barrios: BarrioGeo[], puntos: VoterGeo[]): CalorDeBarrio[] {
  const suma = new Map<string, { total: number; n: number }>()
  for (const p of puntos) {
    if (!p.neighborhoodId) continue
    const s = suma.get(p.neighborhoodId) ?? { total: 0, n: 0 }
    s.total += intensidadDeEstado(p.commitmentStatus); s.n++
    suma.set(p.neighborhoodId, s)
  }
  return barrios.map((b) => {
    const s = suma.get(b.id)
    return { barrio: b, electores: s?.n ?? 0, temperatura: s ? temperaturaDePromedio(s.total / s.n) : 'vacio' }
  })
}

export function colorDe(t: TemperaturaBarrio): string {
  return t === 'vacio' ? COLOR_VACIO : COLOR_TEMPERATURA[t]
}

export function etiquetaDe(t: TemperaturaBarrio): string {
  return t === 'vacio' ? ETIQUETA_VACIO : ETIQUETA_TEMPERATURA[t]
}

export function dibujarCapaCalorBarrios(
  L: typeof import('leaflet'), capa: import('leaflet').FeatureGroup, barrios: BarrioGeo[], puntos: VoterGeo[],
) {
  for (const { barrio, electores, temperatura } of calorPorBarrio(barrios, puntos)) {
    const color = colorDe(temperatura)
    L.polygon(barrio.boundary, {
      color: temperatura === 'vacio' ? '#94a3b8' : color, weight: 1.5, dashArray: temperatura === 'vacio' ? '4' : undefined,
      fillColor: color, fillOpacity: temperatura === 'vacio' ? 0.75 : 0.55, // blanco que tape el mapa base
    })
      .bindPopup(`<b>${barrio.name}</b><br>${barrio.comunaName}<br>${electores} elector(es) · ${etiquetaDe(temperatura)}`)
      .addTo(capa)
  }
}
