'use client'

import { useEffect, useRef } from 'react'

/**
 * Resultado que entrega la extensión apps/extension-censo: lee lo que la
 * persona consultó en la página oficial y lo pasa a esta pestaña por
 * postMessage. Solo se acepta de esta misma ventana y origen.
 */
export function useResultadoExtension(activo: boolean, alRecibir: (texto: string) => void) {
  const cb = useRef(alRecibir)
  cb.current = alRecibir

  useEffect(() => {
    if (!activo) return
    const oir = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return
      if (e.data?.tipo === 'vectra-censo' && typeof e.data.texto === 'string') cb.current(e.data.texto)
    }
    window.addEventListener('message', oir)
    return () => window.removeEventListener('message', oir)
  }, [activo])
}
