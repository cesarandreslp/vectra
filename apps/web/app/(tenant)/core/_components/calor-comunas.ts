import type { ComunaGeo } from '../actions'
import { COLOR_TEMPERATURA, ETIQUETA_TEMPERATURA, type Temperatura } from '@/lib/temperatura'

/**
 * Mapa de calor contra la meta: cada comuna/corregimiento se pinta según cuánto
 * de su meta de votos lleva (comprometidos + voto seguro). Una comuna que debe
 * sacar 50 y tiene 2 es fría, por comprometidos que estén esos 2. Sin nadie
 * registrado: blanco ("sin presencia").
 */
export type TemperaturaZona = Temperatura | 'vacio'

/** Cortes de avance sobre la meta. */
export const CORTE_TIBIO    = 33 // % desde el que deja de ser fría
export const CORTE_CALIENTE = 80 // % desde el que es caliente

const COLOR_VACIO = '#ffffff'

export function avance(c: ComunaGeo): number {
  return c.metaVotos ? Math.round((c.comprometidos / c.metaVotos) * 100) : 0
}

export function temperaturaDe(c: ComunaGeo): TemperaturaZona {
  if (c.totalElectores === 0) return 'vacio'
  const pct = avance(c)
  if (pct < CORTE_TIBIO) return 'frio'
  if (pct < CORTE_CALIENTE) return 'tibio'
  return 'caliente'
}

export function colorDe(t: TemperaturaZona): string {
  return t === 'vacio' ? COLOR_VACIO : COLOR_TEMPERATURA[t]
}

export function etiquetaDe(t: TemperaturaZona): string {
  if (t === 'vacio') return 'Sin presencia'
  const rango = { frio: `< ${CORTE_TIBIO} %`, tibio: `${CORTE_TIBIO}–${CORTE_CALIENTE - 1} %`, caliente: `≥ ${CORTE_CALIENTE} %` }[t]
  return `${ETIQUETA_TEMPERATURA[t]} (${rango})`
}

/** Solo las zonas con meta entran al calor: sin meta no hay contra qué medir. */
export function comunasConMeta(comunas: ComunaGeo[]): ComunaGeo[] {
  return comunas.filter((c) => c.metaVotos)
}

export function dibujarCapaCalorComunas(L: typeof import('leaflet'), capa: import('leaflet').FeatureGroup, comunas: ComunaGeo[]) {
  for (const c of comunasConMeta(comunas)) {
    const t = temperaturaDe(c)
    L.polygon(c.boundary, {
      color: t === 'vacio' ? '#94a3b8' : COLOR_TEMPERATURA[t], weight: 1.5, dashArray: t === 'vacio' ? '4' : undefined,
      fillColor: colorDe(t), fillOpacity: t === 'vacio' ? 0.75 : 0.55,
    })
      .bindPopup(`<b>${c.name}</b><br>${c.comprometidos} de ${c.metaVotos} votos meta (${avance(c)} %)<br>${c.totalElectores} elector(es) registrados`)
      .addTo(capa)
  }
}
