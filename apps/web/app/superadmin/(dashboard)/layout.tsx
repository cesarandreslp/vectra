import { auth } from '@vectra/auth'
import { redirect } from 'next/navigation'
import { AppShell, type NavItem } from '@/app/_components/app-shell'

export default async function SuperadminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'SUPERADMIN') {
    redirect('/superadmin/login')
  }

  const nav: NavItem[] = [
    { href: '/superadmin',                label: 'Dashboard' },
    { href: '/superadmin/clientes',       label: 'Clientes' },
    { href: '/superadmin/clientes/nuevo', label: '+ Nuevo cliente' },
    { href: '/superadmin/formacion',      label: 'Formación' },
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
