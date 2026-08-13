import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { getSurveyStatsByCampaign, getCoberturaEncuestaPorCaptacion } from '../../actions'
import { ResultadosPorPregunta } from '../../_components/resultados-por-pregunta'
import { ToggleSurveyButton } from '../_components/toggle-survey-button'

export default async function CampanaResultadosPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleOrRedirect('ENCUESTAS', ['ADMIN_CAMPANA', 'COORDINADOR'])
  const { id } = await params

  const [stats, cobertura] = await Promise.all([
    getSurveyStatsByCampaign(id),
    getCoberturaEncuestaPorCaptacion(id),
  ])
  if (!stats) notFound()

  const { campania } = stats

  return (
    <div className="space-y-6">
      <div>
        <Link href="/encuestas/campanas" className="text-sm text-blue-700 hover:underline">← Campañas</Link>
      </div>

      <div className="flex justify-between items-start bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{campania.name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            Elección: {new Date(campania.electionDate).toLocaleDateString('es-CO')}
          </p>
        </div>
        <ToggleSurveyButton campaignId={campania.id} isEnabled={campania.isSurveyEnabled} />
      </div>

      <ResultadosPorPregunta {...stats} vacio="Todavía no hay respuestas para esta campaña." />

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Quién la compartió</h2>
        <p className="text-slate-500 text-sm mb-4">
          Electores que registraron gente con su propio QR/link, y a esa gente le llegó y respondió esta encuesta.
        </p>
        {cobertura.length === 0 ? (
          <div className="text-center text-slate-500 italic py-4">Todavía nadie de los captados por un elector ha respondido.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Elector</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Captados</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Respondieron</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cobertura.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-sm">
                    <Link href={`/core/lideres/${c.id}`} className="text-blue-700 hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-3 py-2 text-sm text-right text-slate-600">{c.captados}</td>
                  <td className="px-3 py-2 text-sm text-right font-semibold text-slate-900">{c.respondieron}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
