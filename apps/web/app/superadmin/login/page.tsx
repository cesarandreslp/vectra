import { auth } from '@vectra/auth'
import { redirect } from 'next/navigation'
import { SuperadminLoginForm } from './_components/login-form'

export const metadata = { title: 'Iniciar sesión — SaaS' }

/**
 * Login exclusivo del SUPERADMIN — puerta separada del /login de tenants
 * (provider "superadmin" en packages/auth, rechaza cualquier email que no
 * sea SUPERADMIN). Antes ambos compartían /login; un admin de campaña
 * lograba entrar aquí también, lo cual no correspondía.
 */
export default async function SuperadminLoginPage() {
  const session = await auth()

  if (session?.user?.role === 'SUPERADMIN') {
    redirect('/superadmin')
  }

  return <SuperadminLoginForm />
}
