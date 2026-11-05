'use client'

import { useState, useTransition } from 'react'
import { aprobarAgente, setAgenteActivo, type VistaAgente } from '../actions'

/** Aprobación y encendido: lo que decide si el agente habla y con qué versión. */
export function EstadoAgente({ vista }: { vista: VistaAgente }) {
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState('')

  const correr = (accion: () => Promise<{ success: boolean; error?: string }>) =>
    iniciar(async () => {
      setError('')
      const r = await accion()
      if (!r.success) setError(r.error ?? 'No se pudo.')
    })

  const aprobado = vista.aprobadoEn
    ? `Aprobado el ${new Date(vista.aprobadoEn).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}${vista.aprobadoPor ? ` por ${vista.aprobadoPor}` : ''}`
    : 'Nunca se ha aprobado'

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">
            {vista.activo ? '🟢 Encendido: está respondiendo' : '⚪ Apagado: no responde a nadie'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{aprobado}</div>
        </div>
        <button
          type="button" disabled={pendiente}
          onClick={() => correr(() => setAgenteActivo(!vista.activo))}
          className={`px-4 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-50 ${vista.activo ? 'bg-slate-600' : 'bg-granate'}`}
        >
          {vista.activo ? 'Apagar' : 'Encender'}
        </button>
      </div>

      {vista.cambiosSinAprobar && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-900 m-0">
            Hay cambios guardados que el agente todavía no usa. Sigue hablando con la última versión aprobada.
          </p>
          <button
            type="button" disabled={pendiente} onClick={() => correr(aprobarAgente)}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-amber-600 text-white disabled:opacity-50"
          >
            Aprobar lo guardado
          </button>
        </div>
      )}

      {!vista.whatsappListo && !vista.telegramBot && !vista.correoUrl && (
        <p className="text-xs text-slate-500 m-0">
          No hay ningún canal conectado: aunque esté encendido, no le llega ningún mensaje.
        </p>
      )}
      {error && <p className="text-sm text-red-700 m-0">{error}</p>}
    </section>
  )
}
