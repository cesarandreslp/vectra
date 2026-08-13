import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { getFinanceConfig } from '../../actions'
import { ExpenseForm } from './_components/expense-form'

export default async function NuevoGastoPage() {
  await requireModuleOrRedirect('FINANZAS', ['ADMIN_CAMPANA', 'COORDINADOR'])

  const config = await getFinanceConfig()

  return (
    <div style={{ maxWidth: '650px' }}>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', color: '#0f172a' }}>
        Registrar gasto
      </h1>
      <ExpenseForm topeGastos={config?.topeGastos ?? null} />
    </div>
  )
}
