import { auth } from '@vectra/auth'
import { getTenantDb, superadminDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'

const SUPERADMIN_TENANT_ID = '__superadmin__'

export interface Branding {
  logoUrl:      string | null
  primaryColor: string | null
}

/** Branding del tenant de la sesión activa (logo + color). Null/vacío = branding Vectra por defecto. */
export async function getBranding(): Promise<Branding> {
  const session  = await auth()
  const tenantId = session?.user?.tenantId
  if (!tenantId || tenantId === SUPERADMIN_TENANT_ID) {
    return { logoUrl: null, primaryColor: null }
  }
  return getBrandingByTenantId(tenantId)
}

/** Branding de un tenant conocido por id — para páginas públicas sin sesión (ej: /electores/login). */
export async function getBrandingByTenantId(tenantId: string): Promise<Branding> {
  try {
    const db  = getTenantDb(await getTenantConnection(tenantId))
    const cfg = await db.tenantConfig.findUnique({
      where:  { tenantId },
      select: { logoUrl: true, primaryColor: true },
    })
    return { logoUrl: cfg?.logoUrl ?? null, primaryColor: cfg?.primaryColor ?? null }
  } catch {
    return { logoUrl: null, primaryColor: null }
  }
}

/** Branding de un tenant conocido por slug — para páginas públicas resueltas por ?c= (ej: /registro, /electores/login). */
export async function getBrandingBySlug(slug: string): Promise<Branding & { tenantId: string | null; tenantName: string | null }> {
  const tenant = await superadminDb.tenant.findUnique({ where: { slug }, select: { id: true, name: true, isActive: true } })
  if (!tenant || !tenant.isActive) return { logoUrl: null, primaryColor: null, tenantId: null, tenantName: null }
  const branding = await getBrandingByTenantId(tenant.id)
  return { ...branding, tenantId: tenant.id, tenantName: tenant.name }
}

const SIN_SLUG = { logoUrl: null, primaryColor: null, tenantId: null, tenantName: null }

/**
 * Branding derivado directamente del host, sin depender de que el middleware
 * inyecte ?c=slug (eso solo pasa en MODO 2 del middleware, con
 * TENANT_BASE_DOMAIN configurado — en dev local, con hosts tipo
 * "demo-campana.localhost", nunca se dispara). Toma el primer segmento del
 * hostname como candidato a slug; si no hay tenant con ese slug, cae al
 * branding genérico de Vectra sin error — no es una fuente de verdad de
 * tenant, solo cosmético para no mostrarle a un tenant real el logo de Vectra.
 */
export async function getBrandingFromHost(host: string | null): Promise<Branding & { tenantId: string | null; tenantName: string | null }> {
  if (!host) return SIN_SLUG
  const hostname = host.split(':')[0]
  const partes = hostname.split('.')
  if (partes.length < 2) return SIN_SLUG // "localhost" pelado, sin subdominio

  const candidato = partes[0]
  if (['www', 'api', 'admin', 'superadmin'].includes(candidato)) return SIN_SLUG

  return getBrandingBySlug(candidato)
}
