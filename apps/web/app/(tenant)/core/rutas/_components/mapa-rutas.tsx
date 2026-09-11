'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { type ItemRuta } from '../actions'
import { usePantallaCompleta, BotonPantallaCompleta, ESTILO_MAPA } from '@/app/(tenant)/_components/pantalla-completa'
import { useLimiteMapa, aplicarLimite } from '@/app/(tenant)/_components/limite-mapa'

interface Props {
  items: ItemRuta[]
  onToggleCumplido: (id: string, tipo: ItemRuta['tipo'], cumplido: boolean) => void
}

/** Mapa con la ruta del día — puntos rojos (pendiente) / verdes (cumplido), unidos en el orden de la lista. */
export function MapaRutas({ items, onToggleCumplido }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapaRef     = useRef<import('leaflet').Map | null>(null)
  const capaRef      = useRef<import('leaflet').FeatureGroup | null>(null)
  const pantalla     = usePantallaCompleta(mapaRef)
  const limite       = useLimiteMapa()
  const mascaraRef   = useRef<import('leaflet').LayerGroup | null>(null)

  const ubicados = items.filter((i): i is ItemRuta & { lat: number; lng: number } => i.lat !== null && i.lng !== null)

  useEffect(() => {
    let cancelado = false
    void (async () => {
      const L = (await import('leaflet')).default
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

      capaRef.current?.remove()
      const capa = L.featureGroup().addTo(mapa)
      capaRef.current = capa

      if (ubicados.length === 0) return

      const puntos: [number, number][] = ubicados.map((i) => [i.lat, i.lng])
      L.polyline(puntos, { color: '#0f172a', weight: 3, opacity: 0.6, dashArray: '6 6' }).addTo(capa)

      ubicados.forEach((item, index) => {
        const color = item.cumplido ? '#16a34a' : '#ef4444'
        const marcador = L.circleMarker([item.lat, item.lng], {
          radius: 12, weight: 2, color: '#fff', fillOpacity: 1, fillColor: color,
        })
          .bindTooltip(String(index + 1), { permanent: true, direction: 'center', className: 'marcador-orden' })
          .bindPopup(
            `<b>${item.titulo}</b><br>${new Date(item.startsAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` +
            (item.direccion ? `<br>${item.direccion}` : '') +
            `<br><i>${item.cumplido ? 'Cumplido — clic para revertir' : 'Pendiente — clic para marcar cumplido'}</i>`,
          )
          .on('click', () => onToggleCumplido(item.id, item.tipo, !item.cumplido))
          .addTo(capa)
        void marcador
      })

      mapa.fitBounds(L.latLngBounds(puntos).pad(0.25))
    })()
    return () => { cancelado = true }
  }, [items, limite]) // eslint-disable-line react-hooks/exhaustive-deps

  if (ubicados.length === 0) {
    return (
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
        Ningún punto de la ruta tiene dirección ubicada todavía.
      </div>
    )
  }

  return (
    <div ref={pantalla.contenedorRef} style={pantalla.estiloContenedor}>
      <style>{`.marcador-orden { background: transparent; border: none; box-shadow: none; color: #fff; font-weight: 700; font-size: 0.75rem; }`}</style>
      <div style={pantalla.estiloArea(360)}>
        <div ref={contenedor} style={ESTILO_MAPA} />
        <BotonPantallaCompleta completa={pantalla.completa} onClick={pantalla.alternar} />
      </div>
    </div>
  )
}
