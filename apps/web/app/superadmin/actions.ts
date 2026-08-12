'use server'

/**
 * Server Actions del superadmin.
 * Toda acción verifica rol SUPERADMIN antes de operar.
 * La connectionString NUNCA aparece en ningún valor de retorno.
 */

import {
  superadminDb,
  provisionTenantDatabase,
  mockProvisionTenantDatabase,
  SlugTakenError,
} from '@campaignos/db'
import { put, del } from '@vercel/blob'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth-helpers'
import { invalidarCacheTenant } from '@/lib/tenant'
import { ALL_MODULES } from './modules'

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type ModuleKey =
  | 'CORE'
  | 'ANALYTICS'
  | 'FORMACION'
  | 'DIA_E'
  | 'COMUNICACIONES'
  | 'FINANZAS'
  | 'ENCUESTAS'

export interface CreateTenantInput {
  name:          string
  slug:          string
  adminEmail:    string
  adminPassword: string
  modules:       ModuleKey[]
}

export interface TenantSummary {
  id:            string
  name:          string
  slug:          string
  domain:        string | null
  isActive:      boolean
  activeModules: string[]
  createdAt:     Date
}

// ── Server Actions ────────────────────────────────────────────────────────────

/**
 * Crea un nuevo tenant: provisiona la DB en Neon, crea el usuario administrador
 * y activa los módulos seleccionados. CORE siempre se activa.
 *
 * @returns { success: true, tenantId } o { success: false, error: string }
 */
export async function createTenant(
  data: CreateTenantInput
): Promise<{ success: true; tenantId: string } | { success: false; error: string }> {
  try {
    await requireAuth(['SUPERADMIN'])

    // Validar slug: solo minúsculas, números y guiones, mínimo 3 caracteres
    const regexSlug = /^[a-z0-9-]{3,}$/
    if (!regexSlug.test(data.slug)) {
      return {
        success: false,
        error: 'El slug solo puede contener minúsculas, números y guiones (mínimo 3 caracteres).',
      }
    }

    // Provisionar la DB del tenant — real si hay NEON_API_KEY, mock si no
    const connectionStringPlana = process.env.NEON_API_KEY
      ? await provisionTenantDatabase(data.slug)
      : await mockProvisionTenantDatabase(data.slug)

    // Actualizar el nombre del tenant (el provisioner usa el slug como nombre temporal)
    const tenant = await superadminDb.tenant.update({
      where: { slug: data.slug },
      data:  { name: data.name },
    })

    // Activar módulos — CORE siempre incluido
    const modulos: ModuleKey[] = Array.from(new Set(['CORE' as ModuleKey, ...data.modules]))
    await superadminDb.tenantModule.createMany({
      data:           modulos.map(moduleKey => ({ tenantId: tenant.id, moduleKey, isActive: true })),
      skipDuplicates: true,
    })

    // Crear usuario administrador en la DB del SUPERADMIN (control plane).
    // Ya no se replica User en cada tenant DB — la autenticación es global.
    const passwordHash = await bcrypt.hash(data.adminPassword, 12)
    await superadminDb.user.create({
      data: {
        tenantId: tenant.id,
        email:    data.adminEmail,
        passwordHash,
        role:     'ADMIN_CAMPANA',
        isActive: true,
      },
    })

    revalidatePath('/superadmin/clientes')
    return { success: true, tenantId: tenant.id }

  } catch (err) {
    if (err instanceof SlugTakenError) {
      return { success: false, error: `El slug "${data.slug}" ya está en uso.` }
    }
    // Log del error real en servidor, mensaje genérico al cliente
    console.error('[createTenant]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error interno al crear el tenant. Revisar logs del servidor.' }
  }
}

/**
 * Lista todos los tenants con sus módulos activos.
 * NUNCA incluye connectionString en el retorno.
 */
export async function listTenants(): Promise<TenantSummary[]> {
  await requireAuth(['SUPERADMIN'])

  const tenants = await superadminDb.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      modules: {
        where:  { isActive: true },
        select: { moduleKey: true },
      },
    },
  })

  // Mapeo explícito — garantiza que connectionString nunca se filtre
  return tenants.map(t => ({
    id:            t.id,
    name:          t.name,
    slug:          t.slug,
    domain:        t.domain,
    isActive:      t.isActive,
    activeModules: t.modules.map(m => m.moduleKey),
    createdAt:     t.createdAt,
  }))
}

/**
 * Alterna el estado activo/inactivo de un tenant.
 * Un tenant inactivo no puede autenticarse ni acceder a sus rutas.
 *
 * @returns { success: boolean, isActive: boolean }
 */
export async function toggleTenantStatus(
  tenantId: string
): Promise<{ success: boolean; isActive: boolean }> {
  try {
    await requireAuth(['SUPERADMIN'])

    const actual = await superadminDb.tenant.findUnique({
      where:  { id: tenantId },
      select: { isActive: true },
    })

    if (!actual) return { success: false, isActive: false }

    const actualizado = await superadminDb.tenant.update({
      where:  { id: tenantId },
      data:   { isActive: !actual.isActive },
      select: { isActive: true },
    })

    revalidatePath('/superadmin/clientes')
    return { success: true, isActive: actualizado.isActive }

  } catch (err) {
    console.error('[toggleTenantStatus]', err instanceof Error ? err.message : err)
    return { success: false, isActive: false }
  }
}

// ── Edición de datos del tenant ───────────────────────────────────────────────

export interface TenantEditData {
  id:          string
  name:        string
  slug:        string
  domain:      string | null
  adminUserId: string | null
  adminEmail:  string | null
}

/** Carga los datos editables de un tenant + su admin principal (el más antiguo). */
export async function getTenantForEdit(tenantId: string): Promise<TenantEditData> {
  await requireAuth(['SUPERADMIN'])

  const tenant = await superadminDb.tenant.findUnique({
    where:  { id: tenantId },
    select: { id: true, name: true, slug: true, domain: true },
  })
  if (!tenant) throw new Error('Tenant no encontrado.')

  const admin = await superadminDb.user.findFirst({
    where:   { tenantId, role: 'ADMIN_CAMPANA' },
    orderBy: { createdAt: 'asc' },
    select:  { id: true, email: true },
  })

  return { ...tenant, adminUserId: admin?.id ?? null, adminEmail: admin?.email ?? null }
}

/**
 * Actualiza nombre, slug y dominio del tenant. Slug y dominio son únicos.
 * Cambiar el slug NO rompe la conexión a la DB (la connectionString se guarda
 * aparte, cifrada), pero sí invalida los enlaces de elector con el slug viejo.
 */
export async function updateTenant(
  tenantId: string,
  data: { name: string; slug: string; domain: string | null },
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAuth(['SUPERADMIN'])

    const name   = data.name.trim()
    const slug   = data.slug.trim().toLowerCase()
    const domain = data.domain?.trim().toLowerCase() || null

    if (!name) return { success: false, error: 'El nombre es obligatorio.' }
    if (!/^[a-z0-9-]{3,}$/.test(slug)) {
      return { success: false, error: 'El slug solo permite minúsculas, números y guiones (mínimo 3).' }
    }
    if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      return { success: false, error: 'El dominio no tiene formato válido (ej: campana.com.co).' }
    }

    const actual = await superadminDb.tenant.findUnique({
      where:  { id: tenantId },
      select: { slug: true, domain: true },
    })
    if (!actual) return { success: false, error: 'Tenant no encontrado.' }

    const choqueSlug = await superadminDb.tenant.findFirst({ where: { slug, NOT: { id: tenantId } }, select: { id: true } })
    if (choqueSlug) return { success: false, error: `El slug "${slug}" ya está en uso por otro cliente.` }
    if (domain) {
      const choqueDom = await superadminDb.tenant.findFirst({ where: { domain, NOT: { id: tenantId } }, select: { id: true } })
      if (choqueDom) return { success: false, error: `El dominio "${domain}" ya está en uso por otro cliente.` }
    }

    await superadminDb.tenant.update({ where: { id: tenantId }, data: { name, slug, domain } })

    // Invalidar caché de identificadores viejos y nuevos para que el middleware refleje el cambio.
    invalidarCacheTenant(actual.slug)
    if (actual.domain) invalidarCacheTenant(actual.domain)
    invalidarCacheTenant(slug)
    if (domain) invalidarCacheTenant(domain)

    revalidatePath('/superadmin/clientes')
    revalidatePath(`/superadmin/clientes/${tenantId}/editar`)
    return { success: true }
  } catch (err) {
    console.error('[updateTenant]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error interno al actualizar el tenant.' }
  }
}

/** Actualiza el email del admin del tenant y, opcionalmente, su contraseña. */
export async function updateTenantAdmin(
  tenantId: string,
  data: { adminUserId: string; email: string; newPassword?: string },
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAuth(['SUPERADMIN'])

    const email = data.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: 'Email inválido.' }

    const admin = await superadminDb.user.findFirst({
      where:  { id: data.adminUserId, tenantId, role: 'ADMIN_CAMPANA' },
      select: { id: true },
    })
    if (!admin) return { success: false, error: 'Admin del tenant no encontrado.' }

    const choque = await superadminDb.user.findFirst({ where: { email, NOT: { id: admin.id } }, select: { id: true } })
    if (choque) return { success: false, error: `El email "${email}" ya está en uso.` }

    const cambios: { email: string; passwordHash?: string } = { email }
    if (data.newPassword) {
      if (data.newPassword.length < 8) return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' }
      cambios.passwordHash = await bcrypt.hash(data.newPassword, 12)
    }
    await superadminDb.user.update({ where: { id: admin.id }, data: cambios })

    revalidatePath(`/superadmin/clientes/${tenantId}/editar`)
    return { success: true }
  } catch (err) {
    console.error('[updateTenantAdmin]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error interno al actualizar el admin.' }
  }
}

// ── Gestión de módulos por tenant ─────────────────────────────────────────────
// El catálogo `ALL_MODULES` se exporta desde `./modules` para no violar la
// restricción de Next.js de que `'use server'` solo exporte funciones async.

export interface TenantModuleStatus {
  key:         ModuleKey
  label:       string
  descripcion: string
  isActive:    boolean
}

/**
 * Obtiene el estado de todos los módulos para un tenant.
 * Retorna los 6 módulos con su estado activo/inactivo.
 */
export async function getTenantModules(tenantId: string): Promise<{
  tenant: { id: string; name: string; slug: string }
  modules: TenantModuleStatus[]
}> {
  await requireAuth(['SUPERADMIN'])

  const tenant = await superadminDb.tenant.findUnique({
    where:   { id: tenantId },
    select:  { id: true, name: true, slug: true },
  })

  if (!tenant) throw new Error('Tenant no encontrado.')

  const activos = await superadminDb.tenantModule.findMany({
    where:  { tenantId, isActive: true },
    select: { moduleKey: true },
  })

  const activosSet = new Set(activos.map(m => m.moduleKey))

  return {
    tenant,
    modules: ALL_MODULES.map(m => ({
      ...m,
      isActive: activosSet.has(m.key),
    })),
  }
}

/**
 * Activa o desactiva un módulo para un tenant.
 * CORE no se puede desactivar — lanza error si se intenta.
 */
export async function toggleModule(
  tenantId: string,
  moduleKey: ModuleKey,
): Promise<{ success: boolean; isActive: boolean }> {
  try {
    await requireAuth(['SUPERADMIN'])

    if (moduleKey === 'CORE') {
      return { success: false, isActive: true }
    }

    // Buscar si existe el registro
    const existente = await superadminDb.tenantModule.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
    })

    if (existente) {
      // Toggle isActive
      const updated = await superadminDb.tenantModule.update({
        where: { id: existente.id },
        data:  { isActive: !existente.isActive },
      })
      // Invalidar caché del tenant para que el middleware refleje el cambio
      const tenant = await superadminDb.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true, domain: true },
      })
      if (tenant) {
        invalidarCacheTenant(tenant.slug)
        if (tenant.domain) invalidarCacheTenant(tenant.domain)
      }
      revalidatePath(`/superadmin/clientes/${tenantId}/modulos`)
      revalidatePath('/superadmin/clientes')
      return { success: true, isActive: updated.isActive }
    } else {
      // Crear — activar por primera vez
      await superadminDb.tenantModule.create({
        data: { tenantId, moduleKey, isActive: true },
      })
      const tenant = await superadminDb.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true, domain: true },
      })
      if (tenant) {
        invalidarCacheTenant(tenant.slug)
        if (tenant.domain) invalidarCacheTenant(tenant.domain)
      }
      revalidatePath(`/superadmin/clientes/${tenantId}/modulos`)
      revalidatePath('/superadmin/clientes')
      return { success: true, isActive: true }
    }
  } catch (err) {
    console.error('[toggleModule]', err instanceof Error ? err.message : err)
    return { success: false, isActive: false }
  }
}

// ── Materiales globales de formación ──────────────────────────────────────────

export interface GlobalMaterialSummary {
  id:          string
  title:       string
  description: string | null
  type:        string
  fileUrl:     string
  fileSize:    number | null
  order:       number
  isActive:    boolean
  createdAt:   Date
}

/** Lista todos los materiales globales ordenados por `order` */
export async function listGlobalMaterials(): Promise<GlobalMaterialSummary[]> {
  await requireAuth(['SUPERADMIN'])

  return superadminDb.globalTrainingMaterial.findMany({
    orderBy: { order: 'asc' },
  })
}

/**
 * Crea un nuevo material global. Sube el archivo a Vercel Blob
 * bajo la ruta formacion/global/{filename}.
 */
export async function createGlobalMaterial(formData: FormData): Promise<
  { success: true; id: string } | { success: false; error: string }
> {
  try {
    await requireAuth(['SUPERADMIN'])

    const title       = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const type        = formData.get('type') as string
    const file        = formData.get('file') as File | null

    if (!title || !type) {
      return { success: false, error: 'Título y tipo son obligatorios.' }
    }

    if (!file || file.size === 0) {
      return { success: false, error: 'Debe seleccionar un archivo.' }
    }

    // Subir a Vercel Blob
    const blob = await put(`formacion/global/${file.name}`, file, {
      access: 'public',
    })

    // Determinar el orden (al final)
    const maxOrder = await superadminDb.globalTrainingMaterial.aggregate({
      _max: { order: true },
    })
    const nextOrder = (maxOrder._max.order ?? -1) + 1

    const material = await superadminDb.globalTrainingMaterial.create({
      data: {
        title,
        description,
        type,
        fileUrl:  blob.url,
        fileSize: file.size,
        order:    nextOrder,
      },
    })

    revalidatePath('/superadmin/formacion')
    return { success: true, id: material.id }

  } catch (err) {
    console.error('[createGlobalMaterial]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al crear el material.' }
  }
}

/** Toggle activo/inactivo de un material global */
export async function toggleMaterialStatus(
  id: string
): Promise<{ success: boolean; isActive: boolean }> {
  try {
    await requireAuth(['SUPERADMIN'])

    const actual = await superadminDb.globalTrainingMaterial.findUnique({
      where: { id }, select: { isActive: true },
    })
    if (!actual) return { success: false, isActive: false }

    const updated = await superadminDb.globalTrainingMaterial.update({
      where: { id },
      data:  { isActive: !actual.isActive },
    })

    revalidatePath('/superadmin/formacion')
    return { success: true, isActive: updated.isActive }

  } catch (err) {
    console.error('[toggleMaterialStatus]', err instanceof Error ? err.message : err)
    return { success: false, isActive: false }
  }
}

/** Reordena un material global cambiando su campo order */
export async function reorderMaterial(
  id: string,
  newOrder: number,
): Promise<{ success: boolean }> {
  try {
    await requireAuth(['SUPERADMIN'])

    await superadminDb.globalTrainingMaterial.update({
      where: { id },
      data:  { order: newOrder },
    })

    revalidatePath('/superadmin/formacion')
    return { success: true }

  } catch (err) {
    console.error('[reorderMaterial]', err instanceof Error ? err.message : err)
    return { success: false }
  }
}

/** Elimina un material global y su archivo en Vercel Blob */
export async function deleteGlobalMaterial(
  id: string
): Promise<{ success: boolean }> {
  try {
    await requireAuth(['SUPERADMIN'])

    const material = await superadminDb.globalTrainingMaterial.findUnique({
      where: { id }, select: { fileUrl: true },
    })
    if (!material) return { success: false }

    // Eliminar archivo de Vercel Blob
    await del(material.fileUrl)

    // Eliminar registro de DB
    await superadminDb.globalTrainingMaterial.delete({ where: { id } })

    revalidatePath('/superadmin/formacion')
    return { success: true }

  } catch (err) {
    console.error('[deleteGlobalMaterial]', err instanceof Error ? err.message : err)
    return { success: false }
  }
}
