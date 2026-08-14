'use server'

/**
 * Server Actions de la Configuración de la campaña (solo ADMIN_CAMPANA).
 * - Las claves de IA se CIFRAN antes de guardar y NUNCA se devuelven al cliente.
 * - El dominio propio vive en Tenant (DB del superadmin); el resto en TenantConfig.
 */

import { requireAuth }           from '@/lib/auth-helpers'
import { getTenantConnection }   from '@/lib/tenant'
import { getTenantDb, superadminDb, encrypt } from '@vectra/db'
import { revalidatePath }        from 'next/cache'

const CARGOS = ['ALCALDE', 'CONCEJAL', 'GOBERNADOR', 'DIPUTADO', 'REPRESENTANTE', 'SENADOR', 'PRESIDENTE'] as const
export type Cargo = (typeof CARGOS)[number]

export interface ConfiguracionView {
  hasGroqKey:   boolean
  hasZhipuKey:  boolean
  hasMistralKey: boolean
  logoUrl:      string | null
  primaryColor: string | null
  domain:       string | null
  electionCountry:             string
  electionOffice:               Cargo | null
  electionDepartmentCode:       string | null
  electionMunicipalityDivipola: string | null
}

export interface GuardarConfigInput {
  groqApiKey?:   string  // vacío/omitido = no cambiar
  zhipuApiKey?:  string  // vacío/omitido = no cambiar
  mistralApiKey?: string  // respaldo — vacío/omitido = no cambiar
  primaryColor?: string  // hex, "" = limpiar
  domain?:       string  // "" = limpiar
  electionOffice?:               Cargo | ''  // '' = limpiar
  electionDepartmentCode?:       string      // '' = limpiar
  electionMunicipalityDivipola?: string      // '' = limpiar
}

async function dbTenant(tenantId: string) {
  return getTenantDb(await getTenantConnection(tenantId))
}

export async function getConfiguracion(): Promise<ConfiguracionView> {
  const session = await requireAuth(['ADMIN_CAMPANA'])
  const db      = await dbTenant(session.user.tenantId)

  const cfg    = await db.tenantConfig.findUnique({ where: { tenantId: session.user.tenantId } })
  const tenant = await superadminDb.tenant.findUnique({
    where:  { id: session.user.tenantId },
    select: { domain: true },
  })

  return {
    hasGroqKey:   Boolean(cfg?.groqApiKey),
    hasZhipuKey:  Boolean(cfg?.zhipuApiKey),
    hasMistralKey: Boolean(cfg?.mistralApiKey),
    logoUrl:      cfg?.logoUrl ?? null,
    primaryColor: cfg?.primaryColor ?? null,
    domain:       tenant?.domain ?? null,
    electionCountry:             cfg?.electionCountry ?? 'Colombia',
    electionOffice:               (cfg?.electionOffice as Cargo | null) ?? null,
    electionDepartmentCode:       cfg?.electionDepartmentCode ?? null,
    electionMunicipalityDivipola: cfg?.electionMunicipalityDivipola ?? null,
  }
}

export interface Opcion { code: string; name: string }

/** Departamentos DIVIPOLA para el select en cascada de Configuración y Territorio. */
export async function listarDepartamentos(): Promise<Opcion[]> {
  const session = await requireAuth(['ADMIN_CAMPANA', 'COORDINADOR'])
  const db      = await dbTenant(session.user.tenantId)
  const deptos  = await db.department.findMany({ orderBy: { name: 'asc' } })
  return deptos.map((d) => ({ code: d.code, name: d.name }))
}

/** Municipios de un departamento (por código DIVIPOLA) para el select en cascada. */
export async function listarMunicipios(departmentCode: string): Promise<Opcion[]> {
  const session = await requireAuth(['ADMIN_CAMPANA', 'COORDINADOR'])
  const db      = await dbTenant(session.user.tenantId)
  const muns    = await db.municipality.findMany({
    where:   { department: { code: departmentCode } },
    orderBy: { name: 'asc' },
  })
  return muns.map((m) => ({ code: m.divipola, name: m.name }))
}

export async function guardarConfiguracion(
  input: GuardarConfigInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const session  = await requireAuth(['ADMIN_CAMPANA'])
  const tenantId = session.user.tenantId
  const db       = await dbTenant(tenantId)

  // Validación mínima del color (hex).
  if (input.primaryColor && !/^#[0-9a-fA-F]{6}$/.test(input.primaryColor)) {
    return { success: false, error: 'El color primario debe ser un hex como #7d2839.' }
  }
  if (input.electionOffice && !CARGOS.includes(input.electionOffice)) {
    return { success: false, error: 'Cargo de elección inválido.' }
  }

  // TenantConfig: solo se actualiza lo provisto. Las claves solo se tocan si
  // llegan no vacías (así "guardar" sin re-escribir la clave no la borra).
  const dataConfig: Record<string, unknown> = {}
  if (input.groqApiKey?.trim())  dataConfig.groqApiKey  = encrypt(input.groqApiKey.trim())
  if (input.zhipuApiKey?.trim()) dataConfig.zhipuApiKey = encrypt(input.zhipuApiKey.trim())
  if (input.mistralApiKey?.trim()) dataConfig.mistralApiKey = encrypt(input.mistralApiKey.trim())
  if (input.primaryColor !== undefined) dataConfig.primaryColor = input.primaryColor || null
  if (input.electionOffice !== undefined) dataConfig.electionOffice = input.electionOffice || null
  if (input.electionDepartmentCode !== undefined) dataConfig.electionDepartmentCode = input.electionDepartmentCode || null
  if (input.electionMunicipalityDivipola !== undefined) dataConfig.electionMunicipalityDivipola = input.electionMunicipalityDivipola || null

  await db.tenantConfig.upsert({
    where:  { tenantId },
    update: dataConfig,
    create: { tenantId, ...dataConfig },
  })

  // Dominio propio → Tenant (DB del superadmin). @unique: puede chocar.
  if (input.domain !== undefined) {
    try {
      await superadminDb.tenant.update({
        where: { id: tenantId },
        data:  { domain: input.domain.trim() || null },
      })
    } catch {
      return { success: false, error: 'Ese dominio ya está en uso por otra campaña.' }
    }
  }

  revalidatePath('/core/configuracion')
  return { success: true }
}
