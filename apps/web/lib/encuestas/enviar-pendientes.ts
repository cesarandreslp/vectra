import type { getTenantDb } from '@vectra/db'
import { decrypt } from '@vectra/db'
import { conversationEngine } from './conversation-engine'
import { dailyLimitService } from './daily-limit'

const BATCH_SIZE = 50

export interface ResultadoEnvio {
  status: 'success' | 'skipped' | 'error'
  count?:  number
  reason?: string
  error?:  string
}

/**
 * Envía el primer mensaje de la encuesta a electores en estado PENDIENTE de
 * un tenant, respetando el límite diario. Compartido por el cron
 * (/api/encuestas/cron, todos los tenants) y el botón "Enviar ahora" del
 * admin (un tenant, bajo demanda) — misma lógica, mismo límite diario.
 */
export async function enviarPendientesTenant(
  tenantId: string,
  tenantDb: ReturnType<typeof getTenantDb>,
): Promise<ResultadoEnvio> {
  const config = await tenantDb.tenantConfig.findUnique({ where: { tenantId } })

  if (config && !config.whatsappSurveyEnabled) {
    return { status: 'skipped', reason: 'whatsapp_deshabilitado' }
  }

  if (!config?.whatsappToken || !config.whatsappPhoneId) {
    return { status: 'skipped', reason: 'sin_credenciales_whatsapp' }
  }

  const dailyLimit = config.surveyDailyLimit || 250
  const remaining  = await dailyLimitService.getRemainingCapacity(tenantDb, dailyLimit)
  if (remaining <= 0) {
    return { status: 'skipped', reason: 'daily_limit_reached' }
  }

  const effectiveBatchSize = Math.min(BATCH_SIZE, remaining)
  const pendingVoters = await tenantDb.voter.findMany({
    where:   { tenantId, conversationState: 'PENDIENTE', phone: { not: null } },
    take:    effectiveBatchSize,
    orderBy: { createdAt: 'asc' },
  })

  if (pendingVoters.length === 0) return { status: 'success', count: 0 }

  const credentials = { token: decrypt(config.whatsappToken), phoneId: config.whatsappPhoneId }
  let successCount = 0

  for (const voter of pendingVoters) {
    if (!voter.phone) continue
    try {
      await conversationEngine.startConversation(voter.id, voter.phone, tenantId, tenantDb, credentials)
      successCount++
      // Delay ligero para no saturar la API de WhatsApp.
      await new Promise((r) => setTimeout(r, 500))
    } catch (err) {
      console.error(`[ENCUESTAS] Error con voter ${voter.id}:`, err)
    }
  }

  return { status: 'success', count: successCount }
}
