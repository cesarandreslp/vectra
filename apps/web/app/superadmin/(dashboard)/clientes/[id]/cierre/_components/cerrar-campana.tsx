'use client'

import { useState, useTransition } from 'react'
import { cerrarCampana } from '../../../../../actions-cierre'

/** Paso 2: suprimir. Irreversible: pide la copia hecha, escribir el slug y una confirmación más. */
export function CerrarCampana({ tenantId, slug, hayCopia }: { tenantId: string; slug: string; hayCopia: boolean }) {
  const [escrito, setEscrito] = useState('')
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, iniciar] = useTransition()
  const listo = hayCopia && escrito.trim() === slug

  return (
    <section className="bg-white border border-red-200 rounded-lg p-4 space-y-2">
      <div className="text-sm font-semibold text-red-800">2. Suprimir datos personales y desactivar la campaña</div>
      {!hayCopia && <div className="text-xs text-red-700">Primero descarga la copia del padrón.</div>}
      <label className="block text-xs text-slate-600">
        Para confirmar, escribe <code className="font-mono">{slug}</code>:
        <input value={escrito} onChange={(e) => setEscrito(e.target.value)} disabled={!hayCopia}
          className="mt-1 block w-full border border-slate-300 rounded-md px-3 py-2 font-mono text-sm" />
      </label>
      <button
        type="button" disabled={!listo || pendiente}
        onClick={() => {
          if (!window.confirm('Esto borra los datos personales de toda la campaña y no se puede deshacer. ¿Seguir?')) return
          iniciar(async () => {
            const r = await cerrarCampana(tenantId, escrito)
            setMensaje(r.success ? { ok: true, texto: `Listo: ${r.electores} electores suprimidos. Campaña y cuentas desactivadas.` } : { ok: false, texto: r.error })
          })
        }}
        className="bg-red-700 text-white text-sm font-semibold rounded-md px-4 py-2 disabled:opacity-40"
      >
        {pendiente ? 'Suprimiendo…' : 'Suprimir y desactivar'}
      </button>
      {mensaje && <p className={`text-sm ${mensaje.ok ? 'text-green-700' : 'text-red-700'}`}>{mensaje.texto}</p>}
    </section>
  )
}
