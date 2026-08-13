import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { NewCampaignForm } from './_components/new-campaign-form'

export default async function NuevaCampanaEncuestasPage() {
  await requireModuleOrRedirect('ENCUESTAS', ['ADMIN_CAMPANA'])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Crear Campaña de Encuesta</h1>
        <p className="text-slate-500 text-sm mt-1">
          Define la campaña, los cargos que se van a elegir, los candidatos oficiales y las preguntas que el asistente virtual hará a los electores.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <NewCampaignForm />
      </div>
    </div>
  )
}
