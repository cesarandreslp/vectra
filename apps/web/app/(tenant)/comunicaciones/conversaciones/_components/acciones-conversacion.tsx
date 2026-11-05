'use client'

import { useState, useTransition } from 'react'
import { marcarAtendida, responderConversacion } from '../actions'

/** Responder como persona del equipo y cerrar el escalamiento. El agente sigue respondiendo igual. */
export function AccionesConversacion({ id, pendiente }: { id: string; pendiente: boolean }) {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [enCurso, iniciar] = useTransition()

  const correr = (accion: () => Promise<{ success: boolean; error?: string }>, alSalir?: () => void) =>
    iniciar(async () => {
      setError('')
      const r = await accion()
      if (r.success) alSalir?.()
      else setError(r.error ?? 'No se pudo.')
    })

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <textarea
        rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000}
        placeholder="Responder como persona del equipo…"
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2 justify-end">
        {pendiente && (
          <button
            type="button" disabled={enCurso} onClick={() => correr(() => marcarAtendida(id))}
            className="px-3 py-2 rounded-md text-sm font-semibold border border-slate-300 text-slate-700 disabled:opacity-50"
          >
            Marcar atendida
          </button>
        )}
        <button
          type="button" disabled={enCurso || !texto.trim()}
          onClick={() => correr(() => responderConversacion(id, texto), () => setTexto(''))}
          className="px-3 py-2 rounded-md text-sm font-semibold bg-blue-600 text-white disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
      {error && <p className="text-sm text-red-700 m-0">{error}</p>}
    </div>
  )
}
