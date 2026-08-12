import { redirect } from 'next/navigation'
import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { AppShell } from '@/app/_components/app-shell'
import { navDiaE, SCREENS_DIA_E } from './_lib/nav'

export default async function DiaELayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuthOrRedirect(
    ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'],
    '/login',
    SCREENS_DIA_E,
  )

  if (!session.user.activeModules.includes('DIA_E')) {
    redirect('/no-autorizado')
  }

  const nav = navDiaE(session.user.role, session.user.customPermissions)

  return (
    <AppShell
      moduleName="DÍA E"
      moduleKey="DIA_E"
      tenantName={session.user.tenantName ?? 'Campaña'}
      userEmail={session.user.email ?? ''}
      userRole={session.user.role}
      nav={nav}
      activeModules={session.user.activeModules}
    >
      {children}
    </AppShell>
  )
}
