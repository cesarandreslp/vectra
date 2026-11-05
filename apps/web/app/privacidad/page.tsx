import { superadminDb, getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { politicaSugerida } from '@/lib/politica-datos'
import { FormularioSolicitud } from './_components/formulario-solicitud'

export const metadata = { title: 'Política de tratamiento de datos' }

interface Props { searchParams: Promise<{ c?: string }> }

/**
 * Política de tratamiento de datos de una campaña y formulario de derechos
 * del titular (Ley 1581). Pública: /privacidad?c=<slug>, igual que el registro.
 */
export default async function PrivacidadPage({ searchParams }: Props) {
  const { c: slug } = await searchParams
  const tenant = slug ? await superadminDb.tenant.findUnique({ where: { slug }, select: { id: true, name: true, isActive: true } }) : null
  if (!slug || !tenant?.isActive) {
    return <p style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center', color: '#64748b' }}>Esta página no corresponde a ninguna campaña.</p>
  }

  const db = getTenantDb(await getTenantConnection(tenant.id))
  const cfg = await db.tenantConfig.findUnique({ where: { tenantId: tenant.id }, select: { politicaTratamiento: true, autorizacionContacto: true } })
  const politica = cfg?.politicaTratamiento?.trim() || politicaSugerida(tenant.name, cfg?.autorizacionContacto ?? null)

  return (
    <main style={{ minHeight: '100vh', background: '#f1f5f9', padding: '1.5rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.3rem', margin: 0, color: '#0f172a' }}>Política de tratamiento de datos personales</h1>
        <div style={{ fontSize: '0.95rem', color: '#334155' }}>{tenant.name}</div>
        <section style={{ background: '#fff', borderRadius: 10, padding: '1.25rem', fontSize: '0.875rem', lineHeight: 1.6, color: '#1e293b', whiteSpace: 'pre-line' }}>
          {politica}
        </section>
        <section style={{ background: '#fff', borderRadius: 10, padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem', color: '#0f172a' }}>Ejercer mis derechos</h2>
          <FormularioSolicitud slug={slug} />
        </section>
      </div>
    </main>
  )
}
