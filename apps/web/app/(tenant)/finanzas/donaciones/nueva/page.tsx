import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { getFinanceConfig } from '../../actions'
import { DonationForm } from './_components/donation-form'

export default async function NuevaDonacionPage() {
  await requireModuleOrRedirect('FINANZAS', ['ADMIN_CAMPANA', 'COORDINADOR'])

  const config = await getFinanceConfig()

  return (
    <div style={{ maxWidth: '650px' }}>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', color: '#0f172a' }}>
        Registrar donación
      </h1>
      <DonationForm topeGastos={config?.topeGastos ?? null} />
    </div>
  )
}
