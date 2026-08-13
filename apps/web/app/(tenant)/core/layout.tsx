import { redirect } from 'next/navigation'
import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { AppShell, type NavItem } from '@/app/_components/app-shell'
import { BadgeNotificaciones } from './_components/badge-notificaciones'

const SCREENS_CORE = [
  'CORE_DASHBOARD', 'CORE_ESTRUCTURA', 'CORE_LIDERES', 'CORE_ELECTORES', 'CORE_IMPORTAR', 'CORE_QR',
  'CORE_TERRITORIO', 'CORE_AGENDA', 'CORE_LOGISTICA', 'CORE_ACTIVIDADES', 'CORE_PRESUPUESTOS',
  'CORE_TESORERIA', 'CORE_PERFILES',
  'CORE_RUTAS', 'CORE_ALERTAS', 'CORE_CONFIGURACION',
]

export default async function CoreLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuthOrRedirect(
    ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'],
    '/login',
    SCREENS_CORE,
  )

  if (!session.user.activeModules.includes('CORE')) {
    redirect('/no-autorizado')
  }

  const esAdmin       = ['ADMIN_CAMPANA', 'COORDINADOR'].includes(session.user.role)
  const personalizado = session.user.role === 'PERSONALIZADO'
  // Para roles fijos, cada pantalla ya la controla su propio requireModuleOrRedirect —
  // acá solo se decide si el ítem aparece en el menú. Para PERSONALIZADO, el menú
  // ES el control de acceso visible: solo se listan las pantallas con canView.
  const puedeVer = (screenKey: string) => !personalizado || Boolean(session.user.customPermissions[screenKey]?.canView)

  const nav: NavItem[] = [
    ...(puedeVer('CORE_DASHBOARD') ? [{ href: '/core', label: 'Dashboard' } as NavItem] : []),
    ...(((esAdmin || personalizado) && puedeVer('CORE_ESTRUCTURA')) ? [{ href: '/core/estructura', label: 'Estructura' } as NavItem] : []),
    ...(puedeVer('CORE_LIDERES')   ? [{ href: '/core/lideres', label: 'Líderes' } as NavItem] : []),
    ...(puedeVer('CORE_ELECTORES') ? [{ href: '/core/electores', label: 'Electores' } as NavItem] : []),
    ...(((esAdmin || personalizado) && puedeVer('CORE_IMPORTAR'))   ? [{ href: '/core/importar', label: 'Importar' } as NavItem] : []),
    ...(((esAdmin || personalizado) && puedeVer('CORE_QR'))         ? [{ href: '/core/qr', label: 'QR de captación' } as NavItem] : []),
    ...(((esAdmin || personalizado) && puedeVer('CORE_TERRITORIO')) ? [{ href: '/core/territorio', label: 'Territorio' } as NavItem] : []),
    ...(((esAdmin || personalizado) && puedeVer('CORE_AGENDA'))     ? [{ href: '/core/agenda', label: 'Agenda' } as NavItem] : []),
    ...(((esAdmin || personalizado) && puedeVer('CORE_LOGISTICA'))  ? [{ href: '/core/logistica', label: 'Logística' } as NavItem] : []),
    ...(((esAdmin || personalizado) && puedeVer('CORE_ACTIVIDADES')) ? [{ href: '/core/actividades', label: 'Actividades' } as NavItem] : []),
    ...(((esAdmin || personalizado) && puedeVer('CORE_PRESUPUESTOS')) ? [{ href: '/core/presupuestos', label: 'Presupuestos' } as NavItem] : []),
    // El hub de plata solo tiene sentido con FINANZAS activo: reúne presupuestos (CORE)
    // con gastos/donaciones/tope/informes (FINANZAS). Sin el módulo, presupuestos se
    // queda solo en su ítem de arriba.
    ...(((session.user.role === 'ADMIN_CAMPANA' || (personalizado && puedeVer('CORE_TESORERIA'))) && session.user.activeModules.includes('FINANZAS'))
      ? [{ href: '/core/tesoreria', label: 'Tesorería' } as NavItem] : []),
    ...(((esAdmin || personalizado) && puedeVer('CORE_PERFILES')) ? [{ href: '/core/perfiles', label: 'Perfiles' } as NavItem] : []),
    ...(((esAdmin || personalizado) && puedeVer('CORE_RUTAS'))      ? [{ href: '/core/rutas', label: 'Rutas' } as NavItem] : []),
    ...(puedeVer('CORE_ALERTAS')    ? [{ href: '/core/alertas', label: 'Alertas', badge: <BadgeNotificaciones /> } as NavItem] : []),
    ...((session.user.role === 'ADMIN_CAMPANA' || (personalizado && puedeVer('CORE_CONFIGURACION')))
      ? [{ href: '/core/configuracion', label: 'Configuración' } as NavItem]
      : []),
  ]

  return (
    <AppShell
      moduleName={'CORE'}
      moduleKey="CORE"
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
