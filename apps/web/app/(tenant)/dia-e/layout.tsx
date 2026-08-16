import { redirect } from 'next/navigation'
import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { AppShell } from '@/app/_components/app-shell'
import { getBranding } from '@/lib/branding'
import { LogoutButton } from '@/app/_components/logout-button'
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

  // El testigo NO usa el panel admin: el día E su única tarea es su mesa
  // (preconteo, transmisión del conteo, foto del E-14). Carcasa limpia, móvil,
  // sin sidebar ni switcher de módulos — nada que lo saque de lo suyo.
  if (session.user.role === 'TESTIGO') {
    const { logoUrl } = await getBranding()
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={session.user.tenantName ?? 'Campaña'} style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
            )}
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{session.user.tenantName}</span>
          </div>
          <LogoutButton tono="claro" redirectTo={`/testigo/login?c=${session.user.tenantSlug ?? ''}`} />
        </header>
        <main style={{ maxWidth: 600, margin: '0 auto', padding: '0.5rem 1rem 2rem' }}>
          {children}
        </main>
      </div>
    )
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
