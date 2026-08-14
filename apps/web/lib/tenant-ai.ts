import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb, decrypt } from '@vectra/db'

/**
 * Claves de IA propias del tenant (descifradas), si las configuró en
 * /core/configuracion. `undefined` = usar la clave global del sistema.
 */
export async function getTenantAiKeys(
  tenantId: string,
): Promise<{ groq: string | undefined; zhipu: string | undefined; mistral: string | undefined }> {
  try {
    const db  = getTenantDb(await getTenantConnection(tenantId))
    const cfg = await db.tenantConfig.findUnique({
      where:  { tenantId },
      select: { groqApiKey: true, zhipuApiKey: true, mistralApiKey: true },
    })
    return {
      groq:    descifrarSeguro(cfg?.groqApiKey),
      zhipu:   descifrarSeguro(cfg?.zhipuApiKey),
      mistral: descifrarSeguro(cfg?.mistralApiKey),
    }
  } catch {
    return { groq: undefined, zhipu: undefined, mistral: undefined }
  }
}

function descifrarSeguro(valor: string | null | undefined): string | undefined {
  if (!valor) return undefined
  try {
    return decrypt(valor)
  } catch {
    return undefined
  }
}
