/**
 * Punto de entrada del paquete @vectra/db.
 * Exporta los clientes Prisma para el superadmin y para los tenants.
 *
 * TODO: En una versión futura, separar en dos schemas independientes:
 *   - prisma/superadmin.schema.prisma  (Tenant, TenantModule)
 *   - prisma/tenant.schema.prisma      (User, Leader, Voter, territorios, etc.)
 * Por ahora ambos conjuntos de modelos conviven en un único schema y se
 * acceden mediante clientes Prisma apuntando a bases de datos distintas.
 */

import { neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'
import ws from 'ws'

// Configurar @neondatabase/serverless para entornos serverless (Vercel).
//
// En serverless usamos HTTP fetch en lugar de WebSocket: las funciones
// son efímeras y los WebSockets se cierran antes de tiempo, dando errores
// "Connection terminated unexpectedly". `poolQueryViaFetch` rutea las
// queries del Pool al endpoint HTTP de Neon (sin transacciones, suficiente
// para nuestros usos en authorize y la mayoría de Server Actions).
//
// `webSocketConstructor` queda configurado por compatibilidad con scripts
// locales (seed, create-superadmin) que sí usan WebSocket.
neonConfig.webSocketConstructor = ws
neonConfig.poolQueryViaFetch    = true

// ── Cliente del superadmin ────────────────────────────────────────────────────
// Singleton lazy: el cliente NO se construye al importar este módulo, sino
// la primera vez que se accede a una propiedad. Esto permite que `next build`
// recolecte page data sin necesidad de DATABASE_URL_SUPERADMIN, y aún así
// el primer uso en runtime falla de forma clara si la variable falta.

const globalForPrisma = globalThis as unknown as {
  superadminDb: PrismaClient | undefined
}

function crearClienteSuperadmin(): PrismaClient {
  const connectionString = process.env.DATABASE_URL_SUPERADMIN
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL_SUPERADMIN no está definida. ' +
        'Verifica tu archivo .env en la raíz del monorepo.'
    )
  }
  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({ adapter })
}

function obtenerClienteSuperadmin(): PrismaClient {
  if (globalForPrisma.superadminDb) return globalForPrisma.superadminDb
  const cliente = crearClienteSuperadmin()
  if (process.env.NODE_ENV !== 'production') {
    // Persistir el singleton entre recargas en desarrollo
    globalForPrisma.superadminDb = cliente
  }
  return cliente
}

/**
 * Cliente Prisma para la base de datos del superadmin.
 * Construcción lazy via Proxy — la conexión se difiere al primer uso.
 * Usar en Server Actions y Server Components.
 */
export const superadminDb: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const cliente = obtenerClienteSuperadmin()
    const valor = Reflect.get(cliente, prop, receiver)
    return typeof valor === 'function' ? valor.bind(cliente) : valor
  },
})

// ── Cliente dinámico por tenant ───────────────────────────────────────────────

/**
 * Crea un cliente Prisma para la base de datos de un tenant específico.
 *
 * IMPORTANTE: La connectionString debe llegar DESCIFRADA desde la capa de aplicación.
 * Nunca pasar la cadena cifrada directamente — usar decrypt() de lib/crypto.ts primero.
 *
 * @param connectionString - Cadena de conexión PostgreSQL ya descifrada del tenant
 * @returns Cliente Prisma configurado para la DB del tenant
 */
export function getTenantDb(connectionString: string): PrismaClient {
  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({ adapter })
}

// Re-exportar PrismaClient y Prisma namespace para uso en otros paquetes
export { PrismaClient }
export { Prisma } from '@prisma/client'

// ── Librería de cifrado ───────────────────────────────────────────────────────
// Única fuente de cifrado/descifrado en todo el proyecto
export { encrypt, decrypt, CryptoError } from './crypto'
export type {} from './crypto' // Los tipos se exportan via las clases

// ── Provisionador de tenants ──────────────────────────────────────────────────
export {
  provisionTenantDatabase,
  mockProvisionTenantDatabase,
  TenantProvisionError,
  SlugTakenError,
} from './neon-provisioner'

// ── Seed DIVIPOLA reutilizable ────────────────────────────────────────────────
export { seedDivipola } from './seed-divipola'
export type { SeedDivipolaResult } from './seed-divipola'
