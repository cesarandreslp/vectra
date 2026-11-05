import Link from 'next/link'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { getConversacion, listConversaciones } from './actions'
import { DetalleConversacionVista } from './_components/detalle-conversacion'

interface Props { searchParams: Promise<{ c?: string; todas?: string }> }

const hora = (iso: string) => new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })

export default async function ConversacionesPage({ searchParams }: Props) {
  await requireModuleOrRedirect('COMUNICACIONES', ['ADMIN_CAMPANA', 'COORDINADOR'], 'COMUNICACIONES_CONVERSACIONES')
  const { c, todas } = await searchParams
  const soloPendientes = todas !== '1'
  const [filas, detalle] = await Promise.all([listConversaciones(soloPendientes), c ? getConversacion(c) : null])
  const qs = (extra: Record<string, string | undefined>) =>
    '?' + new URLSearchParams(Object.entries({ todas: soloPendientes ? undefined : '1', ...extra }).filter(([, v]) => v) as [string, string][])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 m-0">Conversaciones del agente</h1>
        <div className="flex gap-2 text-sm">
          <Link href={'?' + (c ? `c=${c}` : '')} className={soloPendientes ? 'font-semibold text-slate-900' : 'text-slate-500'}>Por atender</Link>
          <span className="text-slate-300">|</span>
          <Link href={`?todas=1${c ? `&c=${c}` : ''}`} className={!soloPendientes ? 'font-semibold text-slate-900' : 'text-slate-500'}>Todas</Link>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 m-0 p-0 list-none self-start">
          {filas.length === 0 && (
            <li className="p-4 text-sm text-slate-500">{soloPendientes ? 'Nada escalado esperando a alguien del equipo.' : 'Todavía no hay conversaciones.'}</li>
          )}
          {filas.map((f) => (
            <li key={f.id}>
              <Link href={qs({ c: f.id })} className={`block px-4 py-3 hover:bg-slate-50 ${f.id === c ? 'bg-slate-50' : ''}`}>
                <div className="flex justify-between gap-2 text-sm">
                  <span className="font-semibold text-slate-800">{f.nombre} <span className="font-normal text-slate-400">{f.canal === 'TELEGRAM' ? 'Telegram' : f.canal === 'EMAIL' ? 'correo' : `···${f.telefonoFinal}`}</span></span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{hora(f.ultimoMensajeEn)}</span>
                </div>
                {f.pendiente && <div className="text-xs text-red-700 mt-0.5">⚠ {f.motivo}</div>}
              </Link>
            </li>
          ))}
        </ul>

        {detalle ? <DetalleConversacionVista d={detalle} /> : c ? <p className="text-sm text-slate-500">Conversación no encontrada.</p> : null}
      </div>
    </div>
  )
}
