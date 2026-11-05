import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { getAgente } from './actions'
import { EstadoAgente } from './_components/estado-agente'
import { FormularioAgente } from './_components/formulario-agente'

export default async function AgentePage() {
  await requireModuleOrRedirect('COMUNICACIONES', ['ADMIN_CAMPANA'], 'COMUNICACIONES_AGENTE')
  const vista = await getAgente()

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 m-0">Agente IA de la campaña</h1>
        <p className="text-sm text-slate-500 mt-1">
          Conversa por WhatsApp con quien escriba al número de la campaña, siempre presentándose como asistente de
          inteligencia artificial. Solo dice lo que ustedes aprueben acá.
        </p>
      </div>
      <EstadoAgente vista={vista} />
      <FormularioAgente vista={vista} />
    </div>
  )
}
