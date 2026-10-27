import { redirect } from 'next/navigation'
import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { AppShell, type NavItem } from '@/app/_components/app-shell'

const SCREENS_ANALYTICS = [
  'ANALYTICS_DASHBOARD', 'ANALYTICS_TERRITORIO', 'ANALYTICS_LIDERES',
  'ANALYTICS_PROYECCION', 'ANALYTICS_ESTRATEGIA', 'ANALYTICS_CONFIGURACION',
]

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuthOrRedirect(
    ['ADMIN_CAMPANA', 'COORDINADOR'],
    '/login',
    SCREENS_ANALYTICS,
  )

  if (!session.user.activeModules.includes('ANALYTICS')) {
    redirect('/no-autorizado')
  }

  const personalizado = session.user.role === 'PERSONALIZADO'
  const puedeVer = (screenKey: string) => !personalizado || Boolean(session.user.customPermissions[screenKey]?.canView)

  const nav: NavItem[] = [
    ...(puedeVer('ANALYTICS_DASHBOARD')     ? [{ href: '/analytics', label: 'Dashboard' } as NavItem] : []),
    ...(puedeVer('ANALYTICS_TERRITORIO')    ? [{ href: '/analytics/territorio', label: 'Territorio' } as NavItem] : []),
    ...(puedeVer('ANALYTICS_LIDERES')       ? [{ href: '/analytics/lideres', label: 'Líderes' } as NavItem] : []),
    ...(puedeVer('ANALYTICS_PROYECCION')    ? [{ href: '/analytics/proyeccion', label: 'Proyección' } as NavItem] : []),
    ...(puedeVer('ANALYTICS_ESTRATEGIA')    ? [{ href: '/analytics/estrategia', label: 'Estrategia' } as NavItem] : []),
    ...(puedeVer('ANALYTICS_CONFIGURACION') ? [{ href: '/analytics/configuracion', label: 'Configuración' } as NavItem] : []),
  ]

  return (
    <AppShell
      moduleName="ANALYTICS"
      moduleKey="ANALYTICS"
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
