/**
 * Servicio de provisionamiento de bases de datos Neon por tenant.
 *
 * Flujo principal (provisionTenantDatabase):
 *   1. Verificar que el slug no esté tomado
 *   2. Crear proyecto Neon via API REST
 *   3. Aplicar migraciones con prisma migrate deploy
 *   4. Guardar Tenant en superadminDb con connectionString CIFRADA
 *   5. Retornar connectionString en plano
 *
 * Si NEON_API_KEY no está definida, se usa mockProvisionTenantDatabase
 * que simula el flujo usando DATABASE_URL_SUPERADMIN como placeholder.
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'
import { encrypt } from './crypto'
import { superadminDb } from './index'
import { seedDivipola } from './seed-divipola'

// ── Errores tipados ───────────────────────────────────────────────────────────

export class TenantProvisionError extends Error {
  constructor(message: string, public readonly causa?: unknown) {
    super(message)
    this.name = 'TenantProvisionError'
  }
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`El slug "${slug}" ya está en uso por otro tenant`)
    this.name = 'SlugTakenError'
  }
}

// ── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Reemplaza cualquier connection string de PostgreSQL con "[REDACTED]".
 * Usar SIEMPRE antes de loguear objetos que puedan contener credenciales.
 */
function logSafe(obj: unknown): unknown {
  try {
    const json     = JSON.stringify(obj)
    const redacted = json.replace(/postgresql:\/\/[^\s"'\\]+/g, '[REDACTED]')
    return JSON.parse(redacted)
  } catch {
    return '[objeto no serializable]'
  }
}

/**
 * Resuelve las rutas del binario de prisma y del schema.prisma.
 *
 * En desarrollo local (Next.js dev desde apps/web):
 *   process.cwd() = apps/web/  →  monorepoRoot = apps/web/../../  = raíz
 *
 * En producción (Vercel):
 *   Definir MONOREPO_ROOT y PRISMA_SCHEMA_PATH en las variables de entorno.
 */
function resolverRutasPrisma(): { prismaBin: string; schemaPath: string } {
  const monorepoRoot = process.env.MONOREPO_ROOT
    ?? path.resolve(process.cwd(), '../..')

  // Buscar el binario de prisma en las ubicaciones típicas del monorepo pnpm
  const candidatosPrisma = [
    path.join(monorepoRoot, 'packages/db/node_modules/.bin/prisma'),
    path.join(monorepoRoot, 'node_modules/.bin/prisma'),
    path.join(process.cwd(), 'node_modules/.bin/prisma'),
  ]

  const prismaBin = candidatosPrisma.find(p => {
    try { return existsSync(p) } catch { return false }
  }) ?? 'prisma' // fallback al PATH del sistema

  const schemaPath = process.env.PRISMA_SCHEMA_PATH
    ?? path.join(monorepoRoot, 'packages/db/prisma/schema.prisma')

  return { prismaBin, schemaPath }
}

// ── Operaciones con la API de Neon ───────────────────────────────────────────

interface NeonProyecto {
  projectId:        string
  connectionString: string
}

/** Crea un nuevo proyecto en Neon via la API REST v2 */
async function crearProyectoNeon(slug: string): Promise<NeonProyecto> {
  const neonApiKey = process.env.NEON_API_KEY
  if (!neonApiKey) {
    throw new TenantProvisionError(
      'NEON_API_KEY no está definida. Para desarrollo sin Neon real, ' +
      'deja NEON_API_KEY vacía en .env y el sistema usará el modo mock automáticamente.'
    )
  }

  const response = await fetch('https://console.neon.tech/api/v2/projects', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${neonApiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      project: { name: `vectra-${slug}` },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new TenantProvisionError(
      `La API de Neon retornó error ${response.status} al crear el proyecto. ` +
      `Detalle: ${body}`
    )
  }

  const data = await response.json() as {
    project?: { id?: string }
    connection_uris?: Array<{ connection_uri?: string }>
  }

  const projectId        = data.project?.id
  const connectionString = data.connection_uris?.[0]?.connection_uri

  if (!projectId || !connectionString) {
    // logSafe elimina la connection string antes de loguear
    throw new TenantProvisionError(
      `La API de Neon retornó una respuesta inesperada: ` +
      `${JSON.stringify(logSafe(data))}`
    )
  }

  return { projectId, connectionString }
}

/** Elimina un proyecto de Neon. Usado como rollback cuando la migración falla. */
async function eliminarProyectoNeon(projectId: string): Promise<void> {
  const neonApiKey = process.env.NEON_API_KEY
  if (!neonApiKey) return

  try {
    const response = await fetch(
      `https://console.neon.tech/api/v2/projects/${projectId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${neonApiKey}` },
      }
    )
    if (response.ok) {
      console.log(`[Provisioning] Rollback: proyecto Neon ${projectId} eliminado`)
    } else {
      console.error(`[Provisioning] Rollback parcial: no se pudo eliminar ${projectId} (${response.status})`)
    }
  } catch (err) {
    // Error secundario: loguear pero no propagar — el error principal ya se lanzó
    console.error(`[Provisioning] Rollback falló para el proyecto ${projectId}:`, err)
  }
}

// ── Aplicación de migraciones ─────────────────────────────────────────────────

/**
 * Aplica las migraciones de Prisma a la DB del tenant usando prisma migrate deploy.
 * La connectionString NUNCA aparece en logs (stdio: 'pipe').
 *
 * prisma migrate deploy (no db push) porque:
 * - Aplica solo las migraciones registradas en prisma/migrations/, en orden
 * - Es reproducible y auditable
 * - No hace inferencias destructivas sobre el schema
 * - Es el estándar para entornos de producción
 */
function aplicarMigraciones(connectionString: string): void {
  const { prismaBin, schemaPath } = resolverRutasPrisma()

  try {
    execSync(
      `"${prismaBin}" migrate deploy --schema="${schemaPath}"`,
      {
        // Pasar la connectionString del tenant como DATABASE_URL
        // Sin este env, prisma usaría la DB del superadmin (incorrecto)
        env:   { ...process.env, DATABASE_URL: connectionString },
        stdio: 'pipe', // CRÍTICO: evita que la connectionString aparezca en logs
      }
    )
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? ''
    throw new TenantProvisionError(
      `Error al aplicar migraciones Prisma en la DB del tenant. ` +
      `Stderr: ${stderr}`,
      err
    )
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Provisiona una base de datos Neon para un nuevo tenant.
 *
 * Flujo con rollback automático:
 *   1. Verifica slug único → SlugTakenError si ya existe
 *   2. Crea proyecto Neon → TenantProvisionError si falla la API
 *   3. Aplica migraciones → si falla, elimina el proyecto Neon (rollback)
 *   4. Persiste el Tenant con connectionString CIFRADA
 *   5. Retorna la connectionString en plano para uso inmediato
 *
 * La connectionString NUNCA se loguea en ningún paso.
 *
 * @param slug - Identificador único del tenant (ej: "campana-gomez-2026")
 * @returns connectionString en plano (lista para pasar a getTenantDb())
 * @throws {SlugTakenError}          Si el slug ya está en uso
 * @throws {TenantProvisionError}    Si la API de Neon o las migraciones fallan
 */
export async function provisionTenantDatabase(slug: string): Promise<string> {
  // 1. Verificar unicidad del slug
  const existente = await superadminDb.tenant.findUnique({ where: { slug } })
  if (existente) throw new SlugTakenError(slug)

  console.log(`[Provisioning] Iniciando para slug: ${slug}`)

  // 2. Crear proyecto en Neon
  const { projectId, connectionString } = await crearProyectoNeon(slug)
  console.log(`[Provisioning] Proyecto Neon creado: ${projectId}`)

  // 3. Aplicar migraciones (rollback automático si falla)
  try {
    aplicarMigraciones(connectionString)
    console.log(`[Provisioning] Migraciones aplicadas correctamente`)
  } catch (err) {
    console.error(`[Provisioning] Error en migraciones — iniciando rollback`)
    await eliminarProyectoNeon(projectId)
    throw err // Re-lanzar el TenantProvisionError original
  }

  // 3b. Cargar dataset DIVIPOLA en la nueva DB (33 deptos + 1.103 municipios)
  try {
    const tenantDb = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
    try {
      const r = await seedDivipola(tenantDb)
      console.log(`[Provisioning] DIVIPOLA cargado: ${r.departments} deptos, ${r.municipalities} municipios`)
    } finally {
      await tenantDb.$disconnect()
    }
  } catch (err) {
    console.error(`[Provisioning] Error cargando DIVIPOLA — rollback del proyecto Neon`)
    await eliminarProyectoNeon(projectId)
    throw new TenantProvisionError('Error cargando dataset DIVIPOLA en la DB del tenant', err)
  }

  // 4. Persistir con connectionString CIFRADA
  await superadminDb.tenant.create({
    data: {
      slug,
      name:             slug, // El nombre real lo actualiza createTenant() después
      // CIFRADO: encrypt() aplica AES-256-GCM. Ver packages/db/src/crypto.ts
      connectionString: encrypt(connectionString),
      isActive:         true,
    },
  })

  console.log(`[Provisioning] Tenant persistido correctamente`)

  // 5. Retornar en plano para uso inmediato (createTenant crea el usuario admin)
  return connectionString
}

/**
 * Versión mock del provisionador para desarrollo local sin NEON_API_KEY.
 *
 * Simula el flujo completo usando DATABASE_URL_SUPERADMIN como DB del tenant
 * (ambos apuntan a la misma base de datos — solo válido en desarrollo).
 *
 * Activación: dejar NEON_API_KEY vacía o sin definir en .env
 * El selector en actions.ts elige automáticamente entre real y mock:
 *   if (process.env.NEON_API_KEY) { provisionTenantDatabase(...) }
 *   else                          { mockProvisionTenantDatabase(...) }
 */
export async function mockProvisionTenantDatabase(slug: string): Promise<string> {
  // Guarda dura: el mock NUNCA debe ejecutarse en producción.
  // Si caímos aquí en NODE_ENV=production, alguien malconfiguró el deploy
  // (NEON_API_KEY vacía) y hay que abortar antes de crear un tenant fantasma.
  if (process.env.NODE_ENV === 'production') {
    throw new TenantProvisionError(
      '[Mock] mockProvisionTenantDatabase fue invocado en producción. ' +
      'Esto solo debe ocurrir en desarrollo local. Verificá que NEON_API_KEY ' +
      'esté definida en el entorno de producción.'
    )
  }

  const connectionString = process.env.DATABASE_URL_SUPERADMIN
  if (!connectionString) {
    throw new TenantProvisionError(
      '[Mock] DATABASE_URL_SUPERADMIN no está definida. ' +
      'Es requerida como placeholder en modo mock.'
    )
  }

  console.log(`[Provisioning MOCK] Simulando provisionamiento para: ${slug}`)

  const existente = await superadminDb.tenant.findUnique({ where: { slug } })
  if (existente) throw new SlugTakenError(slug)

  await superadminDb.tenant.create({
    data: {
      slug,
      name:             slug,
      connectionString: encrypt(connectionString), // Cifrada aunque sea mock
      isActive:         true,
    },
  })

  console.log(`[Provisioning MOCK] Tenant mock creado: ${slug}`)
  return connectionString
}
