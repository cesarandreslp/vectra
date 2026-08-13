import { getSurveyConfig } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { SurveyConfigForm } from './_components/survey-config-form'

export default async function ConfiguracionEncuestasPage() {
  await requireModuleOrRedirect('ENCUESTAS', ['ADMIN_CAMPANA'])

  const config = await getSurveyConfig()

  return (
    <div style={{ maxWidth: '600px' }}>
      <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', color: '#0f172a' }}>
        Configuración WhatsApp API
      </h1>
      <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
        Configura las credenciales de Meta Cloud API para el envío automático de encuestas.
      </p>
      <SurveyConfigForm initial={config} />
    </div>
  )
}
