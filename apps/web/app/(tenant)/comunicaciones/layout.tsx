import { redirect } from 'next/navigation'
import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { AppShell, type NavItem } from '@/app/_components/app-shell'

const SCREENS_COMUNICACIONES = [
  'COMUNICACIONES_DASHBOARD', 'COMUNICACIONES_CAMPANAS', 'COMUNICACIONES_PLANTILLAS',
  'COMUNICACIONES_AUTOMATIZACIONES', 'COMUNICACIONES_CONFIGURACION',
  'COMUNICACIONES_AGENTE', 'COMUNICACIONES_CONVERSACIONES',
]

export default async function ComunicacionesLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuthOrRedirect(
    ['ADMIN_CAMPANA', 'COORDINADOR'],
    '/login',
    SCREENS_COMUNICACIONES,
  )

  if (!session.user.activeModules.includes('COMUNICACIONES')) {
    redirect('/no-autorizado')
  }

  const isAdmin        = session.user.role === 'ADMIN_CAMPANA'
  const personalizado  = session.user.role === 'PERSONALIZADO'
  const puedeVer = (screenKey: string) => !personalizado || Boolean(session.user.customPermissions[screenKey]?.canView)

  const nav: NavItem[] = [
    ...(puedeVer('COMUNICACIONES_DASHBOARD')  ? [{ href: '/comunicaciones', label: 'Dashboard' } as NavItem] : []),
    ...(puedeVer('COMUNICACIONES_CAMPANAS')   ? [{ href: '/comunicaciones/campanas', label: 'Campañas' } as NavItem] : []),
    ...(puedeVer('COMUNICACIONES_PLANTILLAS') ? [{ href: '/comunicaciones/plantillas', label: 'Plantillas' } as NavItem] : []),
    ...(puedeVer('COMUNICACIONES_CONVERSACIONES') ? [{ href: '/comunicaciones/conversaciones', label: 'Conversaciones' } as NavItem] : []),
    ...((isAdmin || (personalizado && puedeVer('COMUNICACIONES_AGENTE')))
      ? [{ href: '/comunicaciones/agente', label: 'Agente IA' } as NavItem] : []),
    ...((isAdmin || (personalizado && puedeVer('COMUNICACIONES_AUTOMATIZACIONES')))
      ? [{ href: '/comunicaciones/automatizaciones', label: 'Automatizaciones' } as NavItem] : []),
    ...((isAdmin || (personalizado && puedeVer('COMUNICACIONES_CONFIGURACION')))
      ? [{ href: '/comunicaciones/configuracion', label: 'Config SMTP' } as NavItem] : []),
  ]

  return (
    <AppShell
      moduleName="COMUNICACIONES"
      moduleKey="COMUNICACIONES"
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
