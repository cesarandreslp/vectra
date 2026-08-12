import Link from 'next/link'
import { getTenantForEdit } from '../../../../actions'
import { EditarTenantForm } from './_components/editar-tenant-form'

export const metadata = { title: 'Editar cliente — Superadmin' }

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenant = await getTenantForEdit(id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/superadmin/clientes" className="text-slate-500 text-xs hover:text-granate transition">
          &larr; Volver a clientes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Editar — {tenant.name}</h1>
        <p className="mt-1 text-xs text-slate-400 font-mono">{tenant.slug}</p>
      </div>

      <EditarTenantForm tenant={tenant} />
    </div>
  )
}
