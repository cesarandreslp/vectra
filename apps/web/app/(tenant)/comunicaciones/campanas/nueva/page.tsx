import { listTemplates } from '../../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { CampaignWizard } from './_components/campaign-wizard'

export default async function NuevaCampanaPage() {
  await requireModuleOrRedirect('COMUNICACIONES', ['ADMIN_CAMPANA'])

  const templates = await listTemplates()

  return (
    <div style={{ maxWidth: '800px' }}>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', color: '#0f172a' }}>
        Nueva campaña
      </h1>
      <CampaignWizard templates={templates} />
    </div>
  )
}
