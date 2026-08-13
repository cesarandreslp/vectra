import { getSurveyStats } from './actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'

export default async function EncuestasDashboardPage() {
  await requireModuleOrRedirect('ENCUESTAS', ['ADMIN_CAMPANA', 'COORDINADOR'])

  const stats = await getSurveyStats()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard Encuestas</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-semibold text-slate-500 mb-1">Total Electores</div>
          <div className="text-3xl font-bold text-slate-800">{stats.funnel.total}</div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-semibold text-amber-600 mb-1">Pendientes</div>
          <div className="text-3xl font-bold text-amber-700">{stats.funnel.pending}</div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-semibold text-granate mb-1">En Progreso</div>
          <div className="text-3xl font-bold text-granate-dark">{stats.funnel.inProgress}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm font-semibold text-green-600 mb-1">Completados</div>
          <div className="text-3xl font-bold text-green-700">{stats.funnel.completed}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Estado del Funnel</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Rechazos (No consintió)</span>
            <span className="font-semibold">{stats.funnel.rejected}</span>
          </div>
          {/* Aquí se pueden añadir progresos visuales si se prefiere */}
        </div>
      </div>
    </div>
  )
}
