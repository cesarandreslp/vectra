'use client'

import { useEffect, useState } from 'react'
import { saveSurveyConfig } from '../../actions'

export function SurveyConfigForm({ initial }: { initial: any }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(initial.whatsappSurveyEnabled)
  // El dominio solo se conoce en el navegador; leerlo en el render rompe la hidratación.
  const [origen, setOrigen] = useState('')
  useEffect(() => setOrigen(window.location.origin), [])

  async function action(formData: FormData) {
    setLoading(true)
    setMessage('')

    const tokenIngresado = (formData.get('whatsappToken') as string)?.trim()

    const res = await saveSurveyConfig({
      whatsappSurveyEnabled: whatsappEnabled,
      whatsappToken: tokenIngresado || undefined,
      whatsappAppSecret: (formData.get('whatsappAppSecret') as string)?.trim() || undefined,
      whatsappPhoneId: formData.get('whatsappPhoneId') as string,
      whatsappVerifyToken: formData.get('whatsappVerifyToken') as string,
      botName: formData.get('botName') as string,
      surveyDailyLimit: parseInt(formData.get('surveyDailyLimit') as string) || 250,
    })

    if (res.success) {
      setMessage('Configuración guardada correctamente.')
    } else {
      setMessage(res.error || 'Error desconocido.')
    }
    setLoading(false)
  }

  return (
    <form action={action} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">Usar WhatsApp para encuestas</div>
          <p className="text-xs text-slate-500 mt-0.5">
            Apagado, la encuesta solo se responde desde la app (in-app) — las credenciales de abajo se conservan sin enviarse.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWhatsappEnabled((v) => !v)}
          aria-pressed={whatsappEnabled}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${whatsappEnabled ? 'bg-granate' : 'bg-slate-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${whatsappEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Nombre del Bot</label>
        <input name="botName" defaultValue={initial.botName} className="w-full border rounded px-3 py-2" required disabled={!whatsappEnabled} />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">WhatsApp Token (Meta)</label>
        <input
          name="whatsappToken" type="password" autoComplete="off"
          placeholder={initial.hasWhatsappToken ? '•••••••• (ya configurado)' : 'EAAG…'}
          className="w-full border rounded px-3 py-2" disabled={!whatsappEnabled}
        />
        <p className="text-xs text-slate-500 mt-1">Dejar en blanco para no cambiar el que ya está guardado.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Phone Number ID (Meta)</label>
        <input name="whatsappPhoneId" defaultValue={initial.whatsappPhoneId} className="w-full border rounded px-3 py-2" disabled={!whatsappEnabled} />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">App Secret (Meta)</label>
        <input
          name="whatsappAppSecret" type="password" autoComplete="off"
          placeholder={initial.hasWhatsappAppSecret ? '•••••••• (ya configurado)' : 'Configuración de la app → Básica → Clave secreta'}
          className="w-full border rounded px-3 py-2" disabled={!whatsappEnabled}
        />
        <p className="text-xs text-slate-500 mt-1">Sin él no se acepta ningún mensaje entrante: con él se comprueba que vienen de Meta.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Verify Token (Para Webhook)</label>
        <input name="whatsappVerifyToken" defaultValue={initial.whatsappVerifyToken} className="w-full border rounded px-3 py-2" disabled={!whatsappEnabled} />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">URL del webhook (pégala en Meta)</label>
        <input
          readOnly value={origen + initial.webhookPath}
          onFocus={(e) => e.currentTarget.select()} className="w-full border rounded px-3 py-2 bg-slate-50 font-mono text-xs"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Límite Diario de Mensajes</label>
        <input name="surveyDailyLimit" type="number" defaultValue={initial.surveyDailyLimit} className="w-full border rounded px-3 py-2" required disabled={!whatsappEnabled} />
      </div>

      <button disabled={loading} className="w-full bg-granate text-white font-semibold py-2 rounded-md hover:bg-granate-dark disabled:opacity-50 transition">
        {loading ? 'Guardando...' : 'Guardar Configuración'}
      </button>

      {message && <div className="text-sm mt-2 text-center text-slate-700">{message}</div>}
    </form>
  )
}
