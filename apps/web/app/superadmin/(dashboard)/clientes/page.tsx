import Link from 'next/link'
import { DataTable } from '@campaignos/ui'
import { listTenants, toggleTenantStatus, type TenantSummary } from '../../actions'

export const metadata = { title: 'Clientes — Superadmin' }

export default async function ClientesPage() {
  const tenants = await listTenants()

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500 mt-1">Campañas registradas en la plataforma.</p>
        </div>
        <Link
          href="/superadmin/clientes/nuevo"
          className="shrink-0 bg-oliva text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-oliva-dark transition"
        >
          + Nuevo cliente
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <DataTable
          keyField="id"
          rows={tenants}
          emptyMessage="No hay clientes registrados"
          columns={[
            {
              key:    'name',
              header: 'Nombre',
            },
            {
              key:    'slug',
              header: 'Slug',
              render: (_, row) => (
                <code className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                  {(row as TenantSummary).slug}
                </code>
              ),
            },
            {
              key:    'isActive',
              header: 'Estado',
              render: (_, row) => {
                const tenant = row as TenantSummary
                return (
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      tenant.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {tenant.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                )
              },
            },
            {
              key:    'activeModules',
              header: 'Módulos',
              render: (_, row) => {
                const modulos = (row as TenantSummary).activeModules
                return (
                  <div className="flex flex-wrap gap-1">
                    {modulos.length === 0
                      ? <span className="text-slate-400">—</span>
                      : modulos.map((m) => (
                          <span key={m} className="text-[11px] bg-oliva text-white px-2 py-0.5 rounded font-medium">
                            {m}
                          </span>
                        ))}
                  </div>
                )
              },
            },
            {
              key:    'createdAt',
              header: 'Creado',
              render: (_, row) => (
                <span className="text-slate-500 whitespace-nowrap">
                  {new Date((row as TenantSummary).createdAt).toLocaleDateString('es-CO')}
                </span>
              ),
            },
            {
              key:    'id',
              header: 'Acciones',
              render: (_, row) => {
                const tenant = row as TenantSummary
                return (
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/superadmin/clientes/${tenant.id}/editar`}
                      className="text-granate text-xs font-semibold hover:underline"
                    >
                      Editar
                    </Link>
                    <Link
                      href={`/superadmin/clientes/${tenant.id}/modulos`}
                      className="text-granate text-xs font-semibold hover:underline"
                    >
                      Módulos
                    </Link>
                    <ToggleForm tenantId={tenant.id} isActive={tenant.isActive} />
                  </div>
                )
              },
            },
          ]}
        />
      </div>
    </div>
  )
}

// Componente de formulario para el toggle — usa Server Action directamente
function ToggleForm({ tenantId, isActive }: { tenantId: string; isActive: boolean }) {
  // Acción inline que llama al Server Action con el tenantId capturado
  async function accion() {
    'use server'
    await toggleTenantStatus(tenantId)
  }

  return (
    <form action={accion}>
      <button
        type="submit"
        className={`px-2.5 py-1 rounded border text-xs font-medium transition ${
          isActive
            ? 'border-red-300 text-red-600 hover:bg-red-50'
            : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'
        }`}
      >
        {isActive ? 'Desactivar' : 'Activar'}
      </button>
    </form>
  )
}
