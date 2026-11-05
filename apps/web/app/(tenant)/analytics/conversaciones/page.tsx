import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { ETIQUETA_TEMA, COLOR_TEMA } from '@/lib/agente/tablero'
import { KpiCard } from '../_components/kpi-card'
import { getTableroConversaciones } from './actions'
import { MapaTemas } from './_components/mapa-temas'

const pct = (n: number, de: number) => (de ? `${Math.round((n / de) * 100)} %` : '—')

export default async function ConversacionesTableroPage() {
  await requireModuleOrRedirect('ANALYTICS', ['ADMIN_CAMPANA', 'COORDINADOR'], 'ANALYTICS_CONVERSACIONES')
  const { resumen: r, comunas } = await getTableroConversaciones()
  const nombreComuna = new Map(comunas.map((k) => [k.id, k.name]))
  const maxTema = r.temas[0]?.n ?? 1

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 m-0">Conversaciones del agente</h1>
        <p className="text-sm text-slate-500 mt-1">Cada persona cuenta una vez, aunque escriba muchas veces.</p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <KpiCard titulo="Conversaciones" valor={r.conversaciones} subtitulo={`${r.ultimos7} en los últimos 7 días`} />
        <KpiCard titulo="Autorizaron datos" valor={r.autorizaron} color="#3b82f6" subtitulo={pct(r.autorizaron, r.conversaciones)} />
        <KpiCard titulo="Voluntarios" valor={r.voluntarios} color="#22c55e" />
        <KpiCard titulo="Esperan al equipo" valor={r.pendientes} color="#ef4444" subtitulo={`${r.escaladas} escaladas en total`} />
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-slate-800 mt-0">Del primer mensaje al compromiso</h2>
        <ol className="m-0 p-0 list-none space-y-2">
          {r.embudo.map((e) => (
            <li key={e.etapa} className="text-sm">
              <div className="flex justify-between text-slate-700"><span>{e.etapa}</span><span>{e.n} · {pct(e.n, r.conversaciones)}</span></div>
              <div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-slate-700 rounded" style={{ width: `${r.conversaciones ? (e.n / r.conversaciones) * 100 : 0}%` }} /></div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-slate-500 mb-0 mt-3">
          El voto en sí no se puede medir antes del día E: lo más cerca es el compromiso que registra su líder.
        </p>
      </section>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-slate-800 mt-0">Qué preocupa</h2>
          {r.temas.length === 0 && <p className="text-sm text-slate-500">Todavía no hay temas.</p>}
          <ul className="m-0 p-0 list-none space-y-2">
            {r.temas.map((t) => (
              <li key={t.tema} className="text-sm">
                <div className="flex justify-between text-slate-700"><span>{ETIQUETA_TEMA[t.tema]}</span><span>{t.n}</span></div>
                <div className="h-2 bg-slate-100 rounded"><div className="h-2 rounded" style={{ width: `${(t.n / maxTema) * 100}%`, background: COLOR_TEMA[t.tema] }} /></div>
              </li>
            ))}
          </ul>
        </section>
        <MapaTemas comunas={comunas} porComuna={r.porComuna} />
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        <h2 className="text-base font-semibold text-slate-800 mt-0">Por comuna</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th className="py-1">Comuna</th><th>Personas</th><th>Temas principales</th></tr></thead>
          <tbody>
            {r.porComuna.map((z) => (
              <tr key={z.comunaId ?? 'sin'} className="border-t border-slate-100">
                <td className="py-2 pr-3">{z.comunaId ? nombreComuna.get(z.comunaId) ?? '—' : 'Sin zona (no dijo su barrio)'}</td>
                <td className="pr-3">{z.personas}</td>
                <td>{z.temas.slice(0, 3).map((t) => `${ETIQUETA_TEMA[t.tema]} (${t.n})`).join(' · ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {r.porComuna.length === 0 && <p className="text-sm text-slate-500 mb-0">Sin conversaciones todavía.</p>}
      </section>
    </div>
  )
}
