import Link from 'next/link'
import type { DetalleConversacion } from '../actions'
import { AccionesConversacion } from './acciones-conversacion'

const hora = (iso: string) => new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })

export function DetalleConversacionVista({ d }: { d: DetalleConversacion }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 min-w-0">
      <header className="flex flex-wrap justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">{d.nombre}</div>
          <div className="text-xs text-slate-500">
            {d.canal === 'TELEGRAM' ? 'Telegram (sin celular)' : `WhatsApp ${d.telefono || '· teléfono ilegible'}`} · {d.autorizo ? 'autorizó sus datos' : 'sin autorización de datos'}
            {d.voterId && <> · <Link href={`/core/electores/${d.voterId}`} className="text-blue-700">ficha de elector</Link></>}
          </div>
        </div>
        {d.pendiente && <div className="text-xs bg-red-50 text-red-800 rounded px-2 py-1 self-start">Escalada: {d.motivo}</div>}
        {!d.pendiente && d.atendida && <div className="text-xs text-slate-500 self-start">Atendida {hora(d.atendida)}</div>}
      </header>

      <ol className="space-y-2 m-0 p-0 list-none max-h-[60vh] overflow-y-auto">
        {d.mensajes.map((m) => (
          <li key={m.id} className={`flex ${m.entrante ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
              m.entrante ? 'bg-slate-100 text-slate-900' : m.humano ? 'bg-blue-600 text-white' : 'bg-emerald-50 text-slate-900 border border-emerald-100'
            }`}>
              {m.texto}
              <div className={`text-[10px] mt-1 ${m.humano ? 'text-blue-100' : 'text-slate-400'}`}>
                {hora(m.createdAt)}{!m.entrante && (m.humano ? ' · persona del equipo' : ' · agente IA')}
                {m.temas.length > 0 && ` · ${m.temas.join(', ')}`}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <AccionesConversacion id={d.id} pendiente={d.pendiente} />
    </section>
  )
}
