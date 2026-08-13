import { getSurveyCampaigns } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import Link from 'next/link'
import { ToggleSurveyButton } from './_components/toggle-survey-button'
import { EnviarAhoraButton } from './_components/enviar-ahora-button'

export default async function CampanasEncuestasPage() {
  await requireModuleOrRedirect('ENCUESTAS', ['ADMIN_CAMPANA', 'COORDINADOR'])

  const campaigns = await getSurveyCampaigns()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campañas de Encuesta</h1>
          <p className="text-slate-500 text-sm mt-1">
            Toca una campaña para ver sus resultados.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <EnviarAhoraButton />
          <Link href="/encuestas/campanas/nueva" className="bg-granate text-white px-4 py-2 rounded-md font-semibold hover:bg-granate-dark transition h-fit">
            + Nueva Campaña
          </Link>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center text-slate-500 italic">
          No hay campañas configuradas.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {campaigns.map((camp) => (
            <div key={camp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <Link href={`/encuestas/campanas/${camp.id}`} className="block p-5 hover:bg-slate-50 transition">
                <h2 className="font-bold text-slate-900 truncate">{camp.name}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(camp.electionDate).toLocaleDateString('es-CO')} · {camp.cargos.length} cargo(s)
                </p>
              </Link>
              <div className="flex justify-between items-center px-5 py-3 border-t border-slate-100 bg-slate-50">
                <span className="text-xs text-slate-500">Encuesta</span>
                <ToggleSurveyButton campaignId={camp.id} isEnabled={camp.isSurveyEnabled} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
