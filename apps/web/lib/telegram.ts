/**
 * Telegram Bot API, lo mínimo que usa el agente: validar el token, apuntar el
 * webhook y enviar texto. fetch nativo, sin SDK.
 */

import { createHash, timingSafeEqual } from 'crypto'

const API = 'https://api.telegram.org'

async function llamar<T>(token: string, metodo: string, cuerpo?: Record<string, unknown>): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API}/bot${token}/${metodo}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(cuerpo ?? {}),
    })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; result?: T; description?: string }
    return data.ok ? { ok: true, result: data.result as T } : { ok: false, error: data.description ?? `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error de red' }
  }
}

/** El bot detrás del token (para mostrar @usuario y confirmar que el token sirve). */
export function getMe(token: string) {
  return llamar<{ username: string; first_name: string }>(token, 'getMe')
}

/** Telegram manda cada update a `url` con el header X-Telegram-Bot-Api-Secret-Token = `secreto`. */
export function setWebhook(token: string, url: string, secreto: string) {
  return llamar<boolean>(token, 'setWebhook', { url, secret_token: secreto, allowed_updates: ['message'], drop_pending_updates: true })
}

export function deleteWebhook(token: string) {
  return llamar<boolean>(token, 'deleteWebhook')
}

export async function enviarTelegram(token: string, chatId: string, texto: string): Promise<{ ok: boolean; providerMsgId?: string; error?: string }> {
  const r = await llamar<{ message_id: number }>(token, 'sendMessage', { chat_id: chatId, text: texto.slice(0, 4096) })
  return r.ok ? { ok: true, providerMsgId: `tg:${chatId}:${r.result.message_id}` } : { ok: false, error: r.error }
}

/** Clave de la conversación: Telegram no da el celular, así que se identifica por el chat. */
export function claveTelegram(chatId: string): string {
  return createHash('sha256').update(`telegram:${chatId}`).digest('hex')
}

export function secretoValido(recibido: string | null, esperado: string): boolean {
  if (!recibido) return false
  const a = Buffer.from(recibido), b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}
