import { redirect } from 'next/navigation'
import { auth } from '@vectra/auth'
import { listUsuariosPlataforma } from '../../actions-usuarios'
import { UsuariosPlataforma } from './_components/usuarios-plataforma'

export const metadata = { title: 'Usuarios de la plataforma — Superadmin' }

/** Cuentas que entran al panel del SaaS. Solo SUPERADMIN; el OPERADOR no maneja cuentas. */
export default async function UsuariosPage() {
  if ((await auth())?.user?.role !== 'SUPERADMIN') redirect('/superadmin')
  const usuarios = await listUsuariosPlataforma()
  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Usuarios de la plataforma</h1>
        <p className="mt-1 text-sm text-slate-500">
          <b>Superadmin</b>: todo el panel, incluido crear cuentas y cerrar campañas (máximo 2 activos).{' '}
          <b>Operador</b>: crea y edita campañas, módulos y material de formación; no crea cuentas de la plataforma ni cierra campañas.
        </p>
      </div>
      <UsuariosPlataforma usuarios={usuarios} />
    </div>
  )
}
