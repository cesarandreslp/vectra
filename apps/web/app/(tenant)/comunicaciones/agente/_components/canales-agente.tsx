'use client'

import { useState, useTransition } from 'react'
import { conectarTelegram, desconectarTelegram, type VistaAgente } from '../actions'

/** Por dónde le escriben al agente. WhatsApp se conecta en Encuestas; Telegram, acá. */
export function CanalesAgente({ vista }: { vista: VistaAgente }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [pendiente, iniciar] = useTransition()

  const correr = (accion: () => Promise<{ success: boolean; error?: string }>) =>
    iniciar(async () => {
      setError('')
      const r = await accion()
      if (r.success) setToken('')
      else setError(r.error ?? 'No se pudo.')
    })

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <h2 className="text-base font-semibold text-slate-800 m-0">Canales</h2>

      <div className="text-sm text-slate-700">
        <b>WhatsApp:</b> {vista.whatsappListo ? 'conectado' : 'sin conectar (Encuestas → Configuración API)'}
      </div>

      <div className="text-sm text-slate-700 space-y-2">
        <div>
          <b>Telegram:</b>{' '}
          {vista.telegramBot ? <>conectado como <span className="font-mono">{vista.telegramBot}</span></> : 'sin conectar'}
        </div>
        {vista.telegramBot ? (
          <button
            type="button" disabled={pendiente} onClick={() => correr(desconectarTelegram)}
            className="px-3 py-1.5 rounded-md text-sm font-semibold border border-slate-300 text-slate-700 disabled:opacity-50"
          >
            Desconectar bot
          </button>
        ) : (
          <>
            <p className="text-xs text-slate-500 m-0">
              En Telegram, habla con @BotFather, crea el bot con /newbot y pega aquí el token que te da. Vectra lo
              conecta solo. Telegram no comparte el celular: quien llegue por ahí queda como contacto sin celular
              hasta que se registre.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)}
                placeholder="123456789:AA…" className="flex-1 min-w-[220px] border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
              <button
                type="button" disabled={pendiente || !token.trim()} onClick={() => correr(() => conectarTelegram(token))}
                className="px-4 py-2 rounded-md text-sm font-semibold bg-granate text-white disabled:opacity-50"
              >
                {pendiente ? 'Conectando…' : 'Conectar'}
              </button>
            </div>
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-700 m-0">{error}</p>}
    </section>
  )
}
