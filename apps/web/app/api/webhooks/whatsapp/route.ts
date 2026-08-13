import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { conversationEngine } from '@/lib/encuestas/conversation-engine'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb, superadminDb, decrypt } from '@vectra/db'

/**
 * Webhook Verification (GET) - Meta API
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (challenge && token) {
    // Validar token contra configuración (podría ser estático o por BD si es un solo webhook global)
    // Asumimos un verify_token global para la app que cada tenant comparte.
    const verifyToken = process.env.WHATSAPP_GLOBAL_VERIFY_TOKEN || 'electoss_webhook_2026'
    
    if (token === verifyToken) {
      return new NextResponse(challenge, { status: 200 })
    }
  }
  return new NextResponse('Forbidden', { status: 403 })
}

/**
 * Webhook Receiver (POST) - Meta API
 * 
 * Este webhook es GLOBAL para toda la app. Meta enviará aquí los mensajes
 * de todos los números configurados.
 * Es crucial enrutar correctamente el mensaje usando el phoneNumberId receptor.
 */
export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch (e) {
    console.error('[WEBHOOK] Failed to parse JSON body:', e)
    return new NextResponse('OK', { status: 200 })
  }

  // Meta Webhook Format
  if (body.object === 'whatsapp_business_account') {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.value && change.value.messages) {
          const phoneNumberId = change.value.metadata.phone_number_id
          const message = change.value.messages[0]

          if (message.type === 'text') {
            const fromPhone = message.from
            const text = message.text.body
            const messageId = message.id

            console.log(`[WEBHOOK] Inbound: from=${fromPhone} text="${text}" receiver=${phoneNumberId}`)

            waitUntil(
              processMessageInTenant(fromPhone, text, messageId, phoneNumberId)
                .then(() => console.log(`[WEBHOOK] Engine finished for ${fromPhone}`))
                .catch(err => console.error('[WEBHOOK] Engine error:', err))
            )
          }
        }
      }
    }
  }

  // Si llega en formato YCloud (por si se utiliza como fallback en el futuro)
  if (body?.type === 'whatsapp.inbound_message.received') {
    const msg = body?.whatsappInboundMessage
    if (msg && msg.type === 'text') {
      const fromPhone = msg.from
      const text = msg.text?.body?.trim() || ''
      const messageId = msg.id
      const toPhone = msg.to // phoneNumberId o equivalente

      waitUntil(
        processMessageInTenant(fromPhone, text, messageId, toPhone)
          .then(() => console.log(`[WEBHOOK] Engine finished for ${fromPhone}`))
          .catch(err => console.error('[WEBHOOK] Engine error:', err))
      )
    }
  }

  return new NextResponse('OK', { status: 200 })
}

async function processMessageInTenant(fromPhone: string, text: string, messageId: string, phoneNumberId: string) {
  // 1. Buscar a qué tenant pertenece este phoneNumberId
  // Requiere buscar en todos los tenants. Si solo hay uno, es directo.
  // Pero en arquitectura multi-tenant de Vectra, buscamos en TenantConfig de todos.
  // Optimización: como TenantConfig está en la db local de cada tenant, puede ser costoso buscar en todas.
  // Alternativa: Mantener un caché global de phoneNumberId -> tenantId en la db superadmin.
  
  // Por simplicidad para la integración, vamos a asumir que la conexión db principal (superadmin)
  // tiene una forma de saber el tenant. Añadiremos una tabla o campo global si es necesario en un futuro.
  // De momento buscaremos en los tenants activos de forma serial (no ideal para escala inmensa).
  
  const tenants = await superadminDb.tenant.findMany({ where: { isActive: true } })
  
  let targetTenantId: string | null = null
  let tenantConnectionString: string | null = null
  let whatsappToken: string | null = null

  for (const tenant of tenants) {
    try {
      const connStr = await getTenantConnection(tenant.id)
      const db = getTenantDb(connStr)
      const config = await db.tenantConfig.findUnique({ where: { tenantId: tenant.id } })
      
      if (config?.whatsappPhoneId === phoneNumberId) {
        targetTenantId = tenant.id
        tenantConnectionString = connStr
        whatsappToken = config.whatsappToken ? decrypt(config.whatsappToken) : null
        break
      }
    } catch (e) {
      // Ignorar errores de conexión a tenants individuales
    }
  }

  if (!targetTenantId || !tenantConnectionString) {
    console.error(`[WEBHOOK] No tenant found for phoneNumberId: ${phoneNumberId}`)
    return
  }

  const tenantDb = getTenantDb(tenantConnectionString)
  
  await conversationEngine.processIncomingMessage(
    fromPhone,
    text,
    messageId,
    targetTenantId,
    tenantDb,
    whatsappToken ?? undefined,
    phoneNumberId
  )
}
