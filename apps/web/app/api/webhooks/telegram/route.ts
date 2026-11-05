import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getTenantConnection } from '@/lib/tenant'
import { agenteActivo, atender } from '@/lib/agente/motor'
import { claveTelegram, enviarTelegram, secretoValido } from '@/lib/telegram'
import { getTenantDb, superadminDb, decrypt } from '@vectra/db'

/**
 * Webhook del bot de Telegram de una campaña: /api/webhooks/telegram?c=<slug>.
 * Lo registra Vectra al conectar el bot (Comunicaciones → Agente IA), con un
 * secreto propio de la campaña que Telegram devuelve en cada llamada en el
 * header X-Telegram-Bot-Api-Secret-Token. Sin ese secreto no entra nada.
 *
 * Siempre responde 200 a lo que pasa la verificación: si no, Telegram reintenta
 * el mismo update una y otra vez.
 */

const AVISO_SOLO_TEXTO = 'Por ahora solo puedo leer mensajes de texto. ¿Me lo escribes, por favor?'
const SIN_LECTURA = ['photo', 'voice', 'audio', 'video', 'video_note', 'document', 'sticker'] as const

export async function POST(request: Request) {
  const slug = new URL(request.url).searchParams.get('c')
  const tenant = slug ? await superadminDb.tenant.findUnique({ where: { slug }, select: { id: true, isActive: true } }) : null
  if (!tenant?.isActive) return new NextResponse('Forbidden', { status: 403 })

  const db = getTenantDb(await getTenantConnection(tenant.id))
  const config = await db.tenantConfig.findUnique({
    where: { tenantId: tenant.id }, select: { telegramBotToken: true, telegramWebhookSecret: true },
  })
  if (!config?.telegramBotToken || !config.telegramWebhookSecret
      || !secretoValido(request.headers.get('x-telegram-bot-api-secret-token'), config.telegramWebhookSecret)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const update = await request.json().catch(() => null)
  const msg = update?.message
  // Solo chats privados: el agente conversa uno a uno, no en grupos.
  if (!msg || msg.chat?.type !== 'private' || msg.from?.is_bot) return NextResponse.json({ ok: true })

  const token = decrypt(config.telegramBotToken)
  const chatId = String(msg.chat.id)
  const enviar = (texto: string) => enviarTelegram(token, chatId, texto)

  if (typeof msg.text === 'string') {
    // "/start" es lo primero que manda Telegram al abrir el bot: es un saludo.
    const texto = msg.text.trim() === '/start' ? 'Hola' : msg.text
    if (await agenteActivo(db, tenant.id)) {
      waitUntil(
        atender({
          tenantId: tenant.id, db, canal: 'TELEGRAM', clave: claveTelegram(chatId), destino: chatId, telefono: null,
          texto, providerMsgId: `tg-in:${chatId}:${msg.message_id}`, enviar,
        }).catch((err) => console.error('[TELEGRAM] Error atendiendo:', err)),
      )
    }
  } else if (SIN_LECTURA.some((k) => k in msg)) {
    waitUntil(enviar(AVISO_SOLO_TEXTO).then((r) => { if (!r.ok) console.error('[TELEGRAM] Aviso no enviado:', r.error) }))
  }

  return NextResponse.json({ ok: true })
}
