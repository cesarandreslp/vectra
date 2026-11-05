'use client'

import { conectarCorreo, desconectarCorreo, type VistaAgente } from '../actions'

type Correr = (accion: () => Promise<{ success: boolean; error?: string }>) => void

/** Correo de entrada por Postmark: la campaña reenvía su correo y Postmark se lo pasa al agente. */
export function CanalCorreo({ vista, pendiente, correr }: { vista: VistaAgente; pendiente: boolean; correr: Correr }) {
  return (
    <div className="text-sm text-slate-700 space-y-2 border-t border-slate-100 pt-3">
      <div><b>Correo:</b> {vista.correoUrl ? 'conectado' : 'sin conectar'}</div>
      {!vista.smtpListo && (
        <p className="text-xs text-amber-800 m-0">
          Primero configura el SMTP de la campaña (Comunicaciones → Config SMTP): por ahí salen las respuestas.
        </p>
      )}
      {vista.correoUrl ? (
        <>
          <ol className="text-xs text-slate-500 m-0 pl-4 space-y-1">
            <li>En Postmark, en el servidor de la campaña → Inbound, pega esta URL como webhook:</li>
          </ol>
          <input
            readOnly value={vista.correoUrl} onFocus={(e) => e.currentTarget.select()}
            className="w-full border border-slate-300 rounded-md px-3 py-2 font-mono text-xs bg-slate-50"
          />
          <ol start={2} className="text-xs text-slate-500 m-0 pl-4 space-y-1">
            <li>Copia la dirección de recepción que te da Postmark (…@inbound.postmarkapp.com).</li>
            <li>En el correo de la campaña, crea un reenvío automático hacia esa dirección.</li>
          </ol>
          <p className="text-xs text-slate-500 m-0">
            La URL lleva la clave adentro: no la compartas. Si se filtra, desconecta y vuelve a conectar para cambiarla.
          </p>
          <button
            type="button" disabled={pendiente} onClick={() => correr(desconectarCorreo)}
            className="px-3 py-1.5 rounded-md text-sm font-semibold border border-slate-300 text-slate-700 disabled:opacity-50"
          >
            Desconectar correo
          </button>
        </>
      ) : (
        <button
          type="button" disabled={pendiente} onClick={() => correr(conectarCorreo)}
          className="px-4 py-2 rounded-md text-sm font-semibold bg-granate text-white disabled:opacity-50"
        >
          Conectar correo (Postmark)
        </button>
      )}
    </div>
  )
}
