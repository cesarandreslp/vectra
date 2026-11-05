import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { conversationEngine } from '@/lib/encuestas/conversation-engine'
import { getTenantConnection } from '@/lib/tenant'
import { firmaValida } from '@/lib/whatsapp-firma'
import { agenteActivo, atender, encuestaEnCurso } from '@/lib/agente/motor'
import { getTenantDb, superadminDb, decrypt } from '@vectra/db'
import { sendMessage } from '@vectra/messaging'

/**
 * Webhook de WhatsApp (Meta Cloud API).
 *
 * Cada campaña conecta SU propia app de Meta con su propia URL:
 *   /api/webhooks/whatsapp?c=<slug>
 * El slug elige el tenant (igual que el registro por QR), y las credenciales de
 * ESE tenant prueban que quien llama es Meta: el verify token en el GET y la
 * firma X-Hub-Signature-256 con su App Secret en cada POST. Sin App Secret
 * configurado no entra nada.
 */

const AVISO_SOLO_TEXTO = 'Por ahora solo puedo leer mensajes de texto. ¿Me lo escribes, por favor?'
// Lo que la persona manda y no se puede leer. Reacciones y respuestas de botón
// no van acá: contestarles con el aviso sería ruido.
const SIN_LECTURA = new Set(['image', 'audio', 'video', 'document', 'sticker'])

async function campanaDe(slug: string | null) {
  if (!slug) return null
  const tenant = await superadminDb.tenant.findUnique({ where: { slug }, select: { id: true, isActive: true } })
  if (!tenant?.isActive) return null
  try {
    const db = getTenantDb(await getTenantConnection(tenant.id))
    const config = await db.tenantConfig.findUnique({
      where:  { tenantId: tenant.id },
      select: { whatsappToken: true, whatsappPhoneId: true, whatsappVerifyToken: true, whatsappAppSecret: true },
    })
    return config ? { tenantId: tenant.id, db, config } : null
  } catch {
    return null
  }
}

/** Verificación del webhook: Meta llama una vez al guardarlo en la app. */
export async function GET(request: Request) {
  const params    = new URL(request.url).searchParams
  const token     = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')
  const campana   = await campanaDe(params.get('c'))
  const esperado  = campana?.config.whatsappVerifyToken

  if (challenge && esperado && token === esperado) return new NextResponse(challenge, { status: 200 })
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(request: Request) {
  const cuerpo  = await request.text() // crudo: la firma se calcula sobre estos bytes
  const campana = await campanaDe(new URL(request.url).searchParams.get('c'))
  const secreto = campana?.config.whatsappAppSecret ? decrypt(campana.config.whatsappAppSecret) : null

  if (!campana || !secreto || !firmaValida(cuerpo, request.headers.get('x-hub-signature-256'), secreto)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let body: any
  try {
    body = JSON.parse(cuerpo)
  } catch {
    return new NextResponse('OK', { status: 200 })
  }
  if (body?.object !== 'whatsapp_business_account') return new NextResponse('OK', { status: 200 })

  const { tenantId, db, config } = campana
  const token = config.whatsappToken ? decrypt(config.whatsappToken) : undefined

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value         = change.value
      const phoneNumberId = value?.metadata?.phone_number_id
      // Una app de Meta puede tener varios números: solo atendemos el de esta campaña.
      if (!phoneNumberId || phoneNumberId !== config.whatsappPhoneId) continue

      for (const message of value.messages ?? []) {
        if (message.type === 'text') {
          const texto = message.text?.body ?? ''
          waitUntil(
            atenderTexto(tenantId, db, message.from, texto, message.id, token, phoneNumberId)
              .catch(err => console.error('[WEBHOOK] Error atendiendo:', err)),
          )
        } else if (SIN_LECTURA.has(message.type) && token) {
          // ponytail: si Meta reintenta el webhook, el aviso puede salir dos veces; se deduplica cuando haya log de conversación (Fase 1).
          waitUntil(
            sendMessage({ to: message.from, channel: 'WHATSAPP', body: AVISO_SOLO_TEXTO }, undefined, { token, phoneNumberId })
              .then(r => { if (!r.success) console.error('[WEBHOOK] Aviso no enviado:', r.error) }),
          )
        }
      }
    }
  }

  return new NextResponse('OK', { status: 200 })
}

/**
 * Un texto lo atiende el agente si está encendido y aprobado, salvo que la
 * persona esté a mitad de una encuesta: esa la termina la encuesta. Sin agente,
 * queda como antes (solo encuestas).
 */
async function atenderTexto(
  tenantId: string, db: ReturnType<typeof getTenantDb>, de: string, texto: string,
  messageId: string, token: string | undefined, phoneNumberId: string,
) {
  if (token && await agenteActivo(db, tenantId) && !(await encuestaEnCurso(db, tenantId, de))) {
    await atender({
      tenantId, db, de, texto, providerMsgId: messageId,
      enviar: async (cuerpo) => {
        const r = await sendMessage({ to: de, channel: 'WHATSAPP', body: cuerpo }, undefined, { token, phoneNumberId })
        if (!r.success) console.error('[WEBHOOK] Respuesta del agente no enviada:', r.error)
        return { ok: r.success, providerMsgId: r.providerMsgId }
      },
    })
    return
  }
  await conversationEngine.processIncomingMessage(de, texto, messageId, tenantId, db, token, phoneNumberId)
}
