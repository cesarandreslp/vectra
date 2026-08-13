import Link from 'next/link'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { getSurveyStats, getFidelidadStats } from '../actions'
import { ResultadosPorPregunta } from '../_components/resultados-por-pregunta'

const ESTADOS_FIDELIDAD: { key: string; label: string; color: string }[] = [
  { key: 'SIN_CONTACTAR', label: 'Sin contactar', color: 'bg-slate-400' },
  { key: 'CONTACTADO',    label: 'Contactado',     color: 'bg-blue-400' },
  { key: 'SIMPATIZANTE',  label: 'Simpatizante',   color: 'bg-amber-400' },
  { key: 'COMPROMETIDO',  label: 'Comprometido',   color: 'bg-green-400' },
  { key: 'VOTO_SEGURO',   label: 'Voto seguro',    color: 'bg-green-700' },
]

export default async function ResultadosEncuestasPage() {
  await requireModuleOrRedirect('ENCUESTAS', ['ADMIN_CAMPANA', 'COORDINADOR'])

  const [stats, fidelidad] = await Promise.all([getSurveyStats(), getFidelidadStats()])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Resultados</h1>
        <p className="text-slate-500 text-sm mt-1">
          La fidelidad de tu base ya inscrita es la fuente principal. El bot de WhatsApp es un canal
          complementario para preguntas puntuales, no un reemplazo del seguimiento que ya hacen tus líderes.
        </p>
      </div>

      {/* Fidelidad — fuente principal: commitmentStatus, mantenido por los líderes desde la PWA */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Fidelidad de la base ({fidelidad.total} electores)</h2>
            <p className="text-xs text-slate-500 mt-1">Estado de compromiso registrado por tus líderes — se actualiza desde Electores y la PWA.</p>
          </div>
          <Link href="/core/electores" className="text-sm text-blue-700 hover:underline whitespace-nowrap">
            Ver electores →
          </Link>
        </div>
        <div className="space-y-3">
          {ESTADOS_FIDELIDAD.map((e) => {
            const count = fidelidad.porEstado[e.key] ?? 0
            const percent = fidelidad.total > 0 ? Math.round((count / fidelidad.total) * 100) : 0
            return (
              <div key={e.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{e.label}</span>
                  <span className="font-bold text-slate-900">{count} ({percent}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full ${e.color}`} style={{ width: `${percent}%` }}></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Encuestas — complementario: respuestas de todas las campañas juntas. Para
          ver una campaña puntual, entrar por su tarjeta en /encuestas/campanas. */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Respuestas de encuestas (complementario)</h2>
        <p className="text-slate-500 text-sm mb-4">
          Agregado de todas las campañas — abiertas por IA, o cerradas. Para ver una campaña puntual, entra desde su tarjeta en Campañas.
        </p>
      </div>

      <ResultadosPorPregunta {...stats} vacio="No hay preguntas ni resultados registrados aún." />
    </div>
  )
}
