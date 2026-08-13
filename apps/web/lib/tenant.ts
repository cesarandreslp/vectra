/**
 * Resolución de tenant desde el host.
 * Usado por el middleware y por Server Components que necesiten el contexto del tenant.
 *
 * Implementa un caché en memoria con TTL de 5 minutos para evitar
 * consultas repetidas a la DB del superadmin en cada request.
 *
 * Nota sobre el caché en producción:
 * En Vercel (serverless), cada instancia de función tiene su propio caché en memoria.
 * Esto es aceptable para el MVP — las invalidaciones se propagan en máximo 5 min.
 */

import { superadminDb, decrypt } from '@vectra/db'

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** Contexto del tenant disponible en Server Components y middleware */
export interface TenantContext {
  id:               string
  slug:             string
  name:             string
  /** connectionString YA descifrada — lista para pasar a getTenantDb() */
  connectionString: string
  /** Claves de módulos activos (ej: ["CORE", "ANALYTICS"]) */
  activeModules:    string[]
}

// ── Caché en memoria con TTL ──────────────────────────────────────────────────

const TTL_MS = 5 * 60 * 1000 // 5 minutos

interface EntradaCache {
  data:      TenantContext
  expiresAt: number
}

/** Caché en memoria. Clave: slug o dominio propio del tenant */
const cache = new Map<string, EntradaCache>()

function leerCache(host: string): TenantContext | null {
  const entrada = cache.get(host)
  if (!entrada) return null
  if (Date.now() > entrada.expiresAt) {
    // Expirado — eliminar para evitar acumulación
    cache.delete(host)
    return null
  }
  return entrada.data
}

function escribirCache(host: string, data: TenantContext): void {
  cache.set(host, { data, expiresAt: Date.now() + TTL_MS })
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Busca un tenant por su slug o dominio propio.
 *
 * Flujo:
 *   1. Revisar caché (TTL 5 min) — evita consultas repetidas a superadminDB
 *   2. Consultar superadminDb.tenant por slug o domain
 *   3. Descifrar la connectionString con decrypt() de @vectra/db
 *   4. Cachear el resultado y retornar TenantContext
 *
 * @param host - Slug del subdominio (ej: "campana-demo") o dominio propio
 *               (ej: "campana2026.com"). Sin dominio base ni protocolo.
 * @returns TenantContext con connectionString descifrada, o null si no existe/inactivo
 */
export async function getTenant(host: string): Promise<TenantContext | null> {
  // 1. Revisar caché
  const cached = leerCache(host)
  if (cached) return cached

  // 2. Consultar la DB del superadmin
  const tenant = await superadminDb.tenant.findFirst({
    where: {
      isActive: true,
      OR: [
        { slug:   host },
        { domain: host },
      ],
    },
    include: {
      modules: {
        where:  { isActive: true },
        select: { moduleKey: true },
      },
    },
  })

  if (!tenant) return null

  // 3. Descifrar la connectionString
  //    encrypt() la cifró con AES-256-GCM al guardar en DB
  //    decrypt() la restaura para uso en getTenantDb()
  let connectionString: string
  try {
    connectionString = decrypt(tenant.connectionString)
  } catch (err) {
    // Error de descifrado es crítico — indica ENCRYPTION_KEY incorrecta o dato corrompido
    console.error(
      `[getTenant] Error al descifrar connectionString del tenant "${tenant.slug}". ` +
      `Verificar ENCRYPTION_KEY y la integridad del dato en DB.`,
      err instanceof Error ? err.message : err
    )
    return null
  }

  // 4. Construir contexto y cachear
  const contexto: TenantContext = {
    id:               tenant.id,
    slug:             tenant.slug,
    name:             tenant.name,
    connectionString, // Ya descifrada
    activeModules:    tenant.modules.map(m => m.moduleKey),
  }

  escribirCache(host, contexto)
  // También cachear por dominio propio si existe, para búsquedas futuras
  if (tenant.domain && tenant.domain !== host) {
    escribirCache(tenant.domain, contexto)
  }

  return contexto
}

/**
 * Invalida la entrada del caché para un host específico.
 * Llamar después de actualizar el estado de un tenant (activar, desactivar, etc.)
 *
 * @param host - Slug o dominio del tenant a invalidar
 */
export function invalidarCacheTenant(host: string): void {
  cache.delete(host)
}

// ── Caché de connectionStrings por tenantId ───────────────────────────────────
// Separado del caché por host para acceso directo desde Server Actions.

const cacheConexion = new Map<string, { connectionString: string; expiresAt: number }>()

/**
 * Obtiene la connectionString descifrada de un tenant por su ID.
 * Usa un caché en memoria con TTL de 5 minutos.
 * Usado por las Server Actions del Core para obtener la DB del tenant.
 *
 * @param tenantId - ID del tenant (viene de session.user.tenantId)
 * @returns connectionString ya descifrada, lista para getTenantDb()
 * @throws Error si el tenant no existe o está inactivo
 */
export async function getTenantConnection(tenantId: string): Promise<string> {
  const entrada = cacheConexion.get(tenantId)
  if (entrada && Date.now() < entrada.expiresAt) {
    return entrada.connectionString
  }

  const tenant = await superadminDb.tenant.findUnique({
    where: { id: tenantId, isActive: true },
    select: { connectionString: true },
  })

  if (!tenant) {
    throw new Error(`Tenant "${tenantId}" no encontrado o inactivo.`)
  }

  const connectionString = decrypt(tenant.connectionString)
  cacheConexion.set(tenantId, { connectionString, expiresAt: Date.now() + TTL_MS })
  return connectionString
}
