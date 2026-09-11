'use client'

/**
 * Mapa de calor de "mi gente" en la PWA — gradiente real (leaflet.heat), no
 * puntos de color: azul=frío, amarillo=tibio, rojo=caliente, según qué tan
 * compromentidos estén. Mismo esquema de temperatura que el mapa del admin
 * (lib/temperatura.ts), para que ambos hablen el mismo idioma de colores.
 */

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { intensidadDeEstado, COLOR_TEMPERATURA, ETIQUETA_TEMPERATURA, GRADIENTE_CALOR } from '@/lib/temperatura'
import { usePantallaCompleta, BotonPantallaCompleta, ESTILO_MAPA } from '@/app/(tenant)/_components/pantalla-completa'
import { useLimiteMapa, aplicarLimite } from '@/app/(tenant)/_components/limite-mapa'

export interface PuntoCalor {
  id:               string
  name:             string
  lat:              number
  lng:              number
  commitmentStatus: string
}

export function MapaCalor({ puntos }: { puntos: PuntoCalor[] }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapaRef    = useRef<import('leaflet').Map | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capaRef     = useRef<any>(null)
  const pantalla    = usePantallaCompleta(mapaRef)
  const limite      = useLimiteMapa()
  const mascaraRef  = useRef<import('leaflet').LayerGroup | null>(null)

  useEffect(() => {
    let cancelado = false
    void (async () => {
      // leaflet.heat es un plugin viejo escrito para <script> global (usa `L` a secas,
      // no importa leaflet) — hay que setear window.L ANTES de cargarlo, si no revienta
      // con "L is not defined". No sirve Promise.all: deben cargar en este orden exacto.
      const L = (await import('leaflet')).default
      if (typeof window !== 'undefined') (window as unknown as { L: typeof L }).L = L
      await import('leaflet.heat')
      if (cancelado || !contenedor.current) return

      if (!mapaRef.current) {
        mapaRef.current = L.map(contenedor.current).setView([4.6, -74.08], 5)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(mapaRef.current)
      }
      const mapa = mapaRef.current
      aplicarLimite(L, mapa, limite, mascaraRef)

      capaRef.current?.remove() // saca la capa de la corrida anterior antes de dibujar la nueva

      const puntosHeat: [number, number, number][] = puntos.map((p) => [p.lat, p.lng, intensidadDeEstado(p.commitmentStatus)])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const capa = (L as any).heatLayer(puntosHeat, {
        radius: 30, blur: 22, maxZoom: 16, max: 1.0, gradient: GRADIENTE_CALOR,
      })
      capa.addTo(mapa)
      capaRef.current = capa

      if (puntos.length > 0) {
        mapa.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number])).pad(0.3))
      }
    })()

    return () => { cancelado = true }
  }, [puntos, limite])

  useEffect(() => () => {
    if (mapaRef.current) { mapaRef.current.remove(); mapaRef.current = null }
  }, [])

  return (
    <div ref={pantalla.contenedorRef} style={{ marginBottom: '1rem', ...pantalla.estiloContenedor }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
        {(['frio', 'tibio', 'caliente'] as const).map((t) => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_TEMPERATURA[t], display: 'inline-block' }} />
            {ETIQUETA_TEMPERATURA[t]}
          </span>
        ))}
      </div>
      <div style={pantalla.estiloArea(220)}>
        <div ref={contenedor} style={ESTILO_MAPA} />
        <BotonPantallaCompleta completa={pantalla.completa} onClick={pantalla.alternar} />
      </div>
    </div>
  )
}
