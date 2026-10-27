import { redirect } from 'next/navigation'
import { auth } from '@vectra/auth'
import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { getBranding } from '@/lib/branding'
import { LogoutButton } from '@/app/_components/logout-button'
import { NavBar } from './_components/nav-bar'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { capacidadCalle } from '@/lib/contacto-calle-db'

/**
 * Antes /pwa no tenía guardia a nivel de página — dependía solo de que la API
 * devolviera 401. Se agrega acá porque ahora también entran electores
 * (rol ELECTOR) por su propio login, no solo staff con cuenta de admin.
 *
 * También es donde faltaba el branding de campaña (logo/color) que sí tiene
 * el AppShell de /core — la PWA no pasa por ahí, quedaba con la marca
 * genérica de Vectra.
 */
/** El elector que instala la app desde acá la abre en su puerta, no en "/" (que manda según el rol). */
export async function generateMetadata() {
  const session = await auth()
  if (session?.user?.role !== 'ELECTOR') return {}
  return { manifest: `/manifest/elector?c=${encodeURIComponent(session.user.tenantSlug ?? '')}` }
}

export default async function PwaLayout({ children }: { children: React.ReactNode }) {
  // El TESTIGO no entra a la PWA de electores: el día E su superficie es solo su
  // mesa (ver dia-e/layout). Se lo excluye a propósito — un testigo no viene acá
  // a mirar a sus electores.
  const session = await requireAuthOrRedirect(
    ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'ELECTOR'],
    '/login',
  )

  if (!session.user.activeModules.includes('CORE')) {
    redirect('/no-autorizado')
  }

  const esElector = session.user.role === 'ELECTOR'
  const { logoUrl, primaryColor } = await getBranding()

  // La pestaña de actividades solo tiene sentido para quien responde por alguna:
  // el doliente. Para el resto no existe.
  // La de calle, para el candidato, los jefes de debate y quien les lleva la agenda.
  const db = getTenantDb(await getTenantConnection(session.user.tenantId))
  let esDoliente = false
  if (session.user.voterId) {
    esDoliente = (await db.actividad.count({
      where: { tenantId: session.user.tenantId, dolienteId: session.user.voterId },
    })) > 0
  }
  const mostrarCalle = Boolean(await capacidadCalle(session, db))

  return (
    // Sin este fondo explícito, el navegador aplica su oscurecimiento automático
    // a la página (se ve negra) — el resto de la app lo evita con bg-slate-50
    // del AppShell, pero /pwa no pasa por ahí.
    <div style={{ minHeight: '100vh', background: '#f1f5f9', paddingBottom: '4rem' }}>
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.75rem 1rem 0', maxWidth: '960px', margin: '0 auto', boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={session.user.tenantName ?? 'Campaña'} style={{ height: '28px', width: 'auto', objectFit: 'contain' }} />
          )}
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: primaryColor ?? '#0f172a' }}>
            {session.user.tenantName}
          </span>
        </div>
        <LogoutButton
          tono="claro"
          redirectTo={esElector ? `/electores/login?c=${session.user.tenantSlug ?? ''}` : '/login'}
        />
      </div>
      {children}
      <NavBar mostrarEncuestas={session.user.activeModules.includes('ENCUESTAS')} mostrarActividades={esDoliente} mostrarCalle={mostrarCalle} />
    </div>
  )
}
