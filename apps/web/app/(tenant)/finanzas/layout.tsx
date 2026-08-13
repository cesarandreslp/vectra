import { redirect } from 'next/navigation'
import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { AppShell, type NavItem } from '@/app/_components/app-shell'

const SCREENS_FINANZAS = [
  'FINANZAS_DASHBOARD', 'FINANZAS_GASTOS', 'FINANZAS_DONACIONES',
  'FINANZAS_INFORMES', 'FINANZAS_CONFIGURACION',
]

export default async function FinanzasLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuthOrRedirect(
    ['ADMIN_CAMPANA', 'COORDINADOR'],
    '/login',
    SCREENS_FINANZAS,
  )

  if (!session.user.activeModules.includes('FINANZAS')) {
    redirect('/no-autorizado')
  }

  const isAdmin       = session.user.role === 'ADMIN_CAMPANA'
  const personalizado = session.user.role === 'PERSONALIZADO'
  const puedeVer = (screenKey: string) => !personalizado || Boolean(session.user.customPermissions[screenKey]?.canView)

  const nav: NavItem[] = [
    ...(puedeVer('FINANZAS_DASHBOARD')   ? [{ href: '/finanzas', label: 'Dashboard' } as NavItem] : []),
    ...(puedeVer('FINANZAS_GASTOS')      ? [{ href: '/finanzas/gastos', label: 'Gastos' } as NavItem] : []),
    ...(puedeVer('FINANZAS_DONACIONES')  ? [{ href: '/finanzas/donaciones', label: 'Donaciones' } as NavItem] : []),
    // Presupuestos vive en CORE (no cruza el paywall), pero quien opera la plata lo
    // necesita a mano acá. Su propia pantalla vuelve a validar el acceso.
    ...((isAdmin || (personalizado && puedeVer('CORE_PRESUPUESTOS')))
      ? [{ href: '/core/presupuestos', label: 'Presupuestos' } as NavItem] : []),
    ...((isAdmin || (personalizado && puedeVer('FINANZAS_INFORMES')))
      ? [{ href: '/finanzas/informes', label: 'Informes' } as NavItem] : []),
    ...((isAdmin || (personalizado && puedeVer('FINANZAS_CONFIGURACION')))
      ? [{ href: '/finanzas/configuracion', label: 'Configuración' } as NavItem] : []),
  ]

  return (
    <AppShell
      moduleName="FINANZAS"
      moduleKey="FINANZAS"
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
