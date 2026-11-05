'use client'

import { useEffect, useMemo, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { ETIQUETA_TEMA, COLOR_TEMA, type ZonaTemas } from '@/lib/agente/tablero'
import type { ComunaMapa } from '../actions'

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Cada comuna pintada con el tema que más personas mencionan allí; gris si nadie ha hablado de nada. */
export function MapaTemas({ comunas, porComuna }: { comunas: ComunaMapa[]; porComuna: ZonaTemas[] }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const conPoligono = useMemo(() => comunas.filter((k) => k.boundary && k.boundary.length > 2), [comunas])

  useEffect(() => {
    if (!contenedor.current || conPoligono.length === 0) return
    let mapa: import('leaflet').Map | null = null
    let cancelado = false
    void (async () => {
      const L = (await import('leaflet')).default
      if (cancelado || !contenedor.current) return
      mapa = L.map(contenedor.current)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(mapa)
      const zona = new Map(porComuna.map((z) => [z.comunaId, z]))
      const capa = L.featureGroup()
      for (const k of conPoligono) {
        const z = zona.get(k.id)
        const top = z?.temas[0]
        const color = top ? COLOR_TEMA[top.tema] : '#cbd5e1'
        const detalle = z?.temas.length
          ? z.temas.slice(0, 5).map((t) => `${ETIQUETA_TEMA[t.tema]}: ${t.n}`).join('<br>')
          : 'Sin temas todavía'
        L.polygon(k.boundary!, { color, weight: 2, fillColor: color, fillOpacity: top ? 0.45 : 0.15 })
          .bindPopup(`<b>${escapar(k.name)}</b><br>${z?.personas ?? 0} persona(s)<br>${detalle}`)
          .addTo(capa)
      }
      capa.addTo(mapa)
      mapa.fitBounds(capa.getBounds().pad(0.1))
    })()
    return () => { cancelado = true; mapa?.remove() }
  }, [conPoligono, porComuna])

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="text-base font-semibold text-slate-800 mt-0">Tema principal por comuna</h2>
      {conPoligono.length === 0
        ? <p className="text-sm text-slate-500">No hay comunas con límites cargados.</p>
        : <div ref={contenedor} style={{ height: 340, borderRadius: 8 }} />}
    </section>
  )
}
