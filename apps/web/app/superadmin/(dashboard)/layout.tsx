import { auth } from '@vectra/auth'
import { redirect } from 'next/navigation'
import { AppShell, type NavItem } from '@/app/_components/app-shell'

export default async function SuperadminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const rol = session?.user?.role
  if (!session?.user || (rol !== 'SUPERADMIN' && rol !== 'OPERADOR')) {
    redirect('/superadmin/login')
  }

  const nav: NavItem[] = [
    { href: '/superadmin',                label: 'Dashboard' },
    { href: '/superadmin/clientes',       label: 'Clientes' },
    { href: '/superadmin/clientes/nuevo', label: '+ Nuevo cliente' },
    { href: '/superadmin/formacion',      label: 'Formación' },
    ...(rol === 'SUPERADMIN' ? [{ href: '/superadmin/usuarios', label: 'Usuarios' }] : []),
    { href: '/superadmin/seguridad',      label: 'Seguridad' },
  ]

  return (
    <AppShell
      moduleName="ADMIN"
      tenantName="Vectra"
      userEmail={session.user.email ?? ''}
      userRole={session.user.role}
      nav={nav}
    >
      {children}
    </AppShell>
  )
}
