'use client'

import { useEffect, useState } from 'react'
import type { LimiteMapa } from '@/lib/jurisdiccion'
import { getLimiteMapa } from '../actions-mapa'

/**
 * Contorno de la jurisdicción de la campaña (municipio, departamento o país,
 * según el cargo). null = sin cargo/territorio configurado: mapa sin acotar.
 */
export function useLimiteMapa(): LimiteMapa | null {
  const [limite, setLimite] = useState<LimiteMapa | null>(null)
  useEffect(() => {
    let vigente = true
    getLimiteMapa().then((l) => { if (vigente) setLimite(l) }).catch(() => {}) // best-effort
    return () => { vigente = false }
  }, [])
  return limite
}

// Rectángulo que cubre el planeta: la jurisdicción se le recorta como agujero.
const MUNDO: [number, number][] = [[-89.9, -179.9], [-89.9, 179.9], [89.9, 179.9], [89.9, -179.9]]

/** Un solo listener de resize por mapa, aunque aplicarLimite corra en cada redibujo. */
const zoomMinimoPorMapa = new WeakMap<import('leaflet').Map, () => void>()

/**
 * Acota el mapa a la jurisdicción: opaca todo lo de afuera, dibuja el borde y
 * no deja arrastrar ni alejar el zoom más allá del territorio.
 * Idempotente: `ref` guarda la capa anterior para reemplazarla en cada llamada.
 */
export function aplicarLimite(
  L: typeof import('leaflet'),
  mapa: import('leaflet').Map,
  limite: LimiteMapa | null,
  ref: { current: import('leaflet').LayerGroup | null },
): void {
  ref.current?.remove()
  ref.current = null
  if (!limite || limite.anillos.length === 0) return

  const mascara = L.polygon([MUNDO, ...limite.anillos], {
    stroke: false, fillColor: '#0f172a', fillOpacity: 0.45, interactive: false,
  })
  const borde = L.polygon(limite.anillos, { color: '#0f172a', weight: 2, fill: false, interactive: false })
  ref.current = L.layerGroup([mascara, borde]).addTo(mapa)
  mascara.bringToBack() // debajo de puntos y polígonos de la campaña

  const zona = L.latLngBounds(limite.anillos.flat()).pad(0.05)
  mapa.options.maxBoundsViscosity = 1 // borde duro: no rebota hacia afuera
  mapa.setMaxBounds(zona)
  // El zoom mínimo depende del tamaño del contenedor: se recalcula al entrar y
  // salir de pantalla completa.
  const ajustarZoomMinimo = () => mapa.setMinZoom(mapa.getBoundsZoom(zona))
  const previo = zoomMinimoPorMapa.get(mapa)
  if (previo) mapa.off('resize', previo)
  zoomMinimoPorMapa.set(mapa, ajustarZoomMinimo)
  mapa.on('resize', ajustarZoomMinimo)
  ajustarZoomMinimo()
}
