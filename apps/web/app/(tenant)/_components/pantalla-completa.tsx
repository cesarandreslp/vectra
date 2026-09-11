'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

/**
 * Pantalla completa para los mapas de Leaflet.
 *
 * Usa la Fullscreen API donde existe (escritorio, Android). Safari de iPhone
 * solo la permite en videos, así que ahí queda un overlay fijo sobre todo el
 * viewport. Los estilos fijos se aplican en ambos casos: el layout es el mismo
 * y lo único que cambia es si el navegador esconde además sus barras.
 *
 * Se lleva el contenedor entero (controles + mapa), no solo el mapa, para poder
 * cambiar de vista o de filtro sin salir de pantalla completa.
 */
export function usePantallaCompleta(mapaRef: RefObject<import('leaflet').Map | null>) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [completa, setCompleta] = useState(false)

  // Salir con Esc de la pantalla completa nativa no pasa por nuestro botón.
  useEffect(() => {
    const alCambiar = () => { if (!document.fullscreenElement) setCompleta(false) }
    document.addEventListener('fullscreenchange', alCambiar)
    return () => document.removeEventListener('fullscreenchange', alCambiar)
  }, [])

  useEffect(() => {
    // Leaflet mide el contenedor al crearse: sin esto quedan cuadros grises
    // donde antes no había mapa. Un frame para que el tamaño nuevo ya esté aplicado.
    const frame = requestAnimationFrame(() => mapaRef.current?.invalidateSize())
    if (!completa) return () => cancelAnimationFrame(frame)

    const conEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCompleta(false) } // overlay de iPhone
    window.addEventListener('keydown', conEsc)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', conEsc) }
  }, [completa, mapaRef])

  const alternar = useCallback(async () => {
    if (completa) {
      setCompleta(false)
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      return
    }
    setCompleta(true)
    const el = contenedorRef.current
    if (el?.requestFullscreen) await el.requestFullscreen().catch(() => {}) // sin permiso: queda el overlay
  }, [completa])

  const estiloContenedor: CSSProperties = completa
    ? {
        position: 'fixed', inset: 0, zIndex: 10000, margin: 0, padding: '0.75rem',
        background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'auto',
      }
    : {}

  /** Caja del mapa: alto fijo normalmente, todo el espacio que sobra en pantalla completa. */
  const estiloArea = (alto: number): CSSProperties => ({
    position: 'relative',
    ...(completa ? { flex: 1, minHeight: 300 } : { height: alto }),
  })

  return { contenedorRef, completa, alternar, estiloContenedor, estiloArea }
}

/** El div de Leaflet llena la caja de estiloArea, mida lo que mida. */
export const ESTILO_MAPA: CSSProperties = {
  position: 'absolute', inset: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 0,
}

export function BotonPantallaCompleta({ completa, onClick }: { completa: boolean; onClick: () => void }) {
  const titulo = completa ? 'Salir de pantalla completa' : 'Ver en pantalla completa'
  return (
    <button
      type="button" onClick={onClick} title={titulo} aria-label={titulo}
      style={{
        position: 'absolute', top: 10, right: 10, zIndex: 1000, // encima de los panes de Leaflet (≤ 1000)
        width: 34, height: 34, display: 'grid', placeItems: 'center', cursor: 'pointer',
        background: '#fff', color: '#0f172a', border: '2px solid rgba(0,0,0,0.2)', borderRadius: 4,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d={completa
          ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'
          : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} />
      </svg>
    </button>
  )
}
