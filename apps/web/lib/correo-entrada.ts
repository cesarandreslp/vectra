/**
 * Correo de entrada (Postmark Inbound): lo que no toca la base, para probarlo solo.
 * La campaña reenvía su correo a la dirección de recepción de Postmark, y Postmark
 * le hace POST a /api/webhooks/correo?c=<slug> con usuario y clave en la URL
 * (autenticación básica): esa clave es TenantConfig.correoEntradaSecreto.
 */

import { createHash, timingSafeEqual } from 'crypto'

export const USUARIO_WEBHOOK = 'vectra'

export interface CorreoEntrante {
  de:        string // dirección, en minúsculas
  nombre:    string | null
  asunto:    string
  texto:     string // solo lo nuevo: sin el hilo citado
  messageId: string | null
}

/** Clave de la conversación: sha256('email:' + dirección). Nunca cruza con un celular ni un chat. */
export function claveCorreo(direccion: string): string {
  return createHash('sha256').update(`email:${direccion.trim().toLowerCase()}`).digest('hex')
}

/** ¿El header Authorization es el Basic que armamos con el secreto de la campaña? */
export function autorizado(header: string | null, secreto: string): boolean {
  if (!header?.startsWith('Basic ')) return false
  const esperado = Buffer.from(`Basic ${Buffer.from(`${USUARIO_WEBHOOK}:${secreto}`).toString('base64')}`)
  const recibido = Buffer.from(header)
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado)
}

const REMITENTE_AUTOMATICO = /^(no-?reply|mailer-daemon|postmaster|bounce|notifications?)@/i

/**
 * El JSON de Postmark → lo que el agente atiende. null = no se contesta:
 * respuestas automáticas (vacaciones, rebotes), remitentes de sistema, o
 * correos de la propia campaña (si no, el agente se contestaría a sí mismo en bucle).
 */
export function leerCorreo(p: any, direccionesPropias: string[]): CorreoEntrante | null {
  const de = typeof p?.FromFull?.Email === 'string' ? p.FromFull.Email.trim().toLowerCase()
    : typeof p?.From === 'string' ? p.From.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(de) || REMITENTE_AUTOMATICO.test(de)) return null
  if (direccionesPropias.some((d) => d.trim().toLowerCase() === de)) return null

  const headers: { Name?: string; Value?: string }[] = Array.isArray(p?.Headers) ? p.Headers : []
  const header = (n: string) => headers.find((h) => h.Name?.toLowerCase() === n)?.Value?.toLowerCase() ?? ''
  const auto = header('auto-submitted')
  if ((auto && auto !== 'no') || header('x-autoreply') || header('x-autorespond') || header('precedence') === 'bulk') return null

  // StrippedTextReply trae solo lo nuevo de una respuesta; si no viene, el cuerpo entero.
  const crudo = typeof p?.StrippedTextReply === 'string' && p.StrippedTextReply.trim()
    ? p.StrippedTextReply : typeof p?.TextBody === 'string' ? p.TextBody : ''
  const texto = crudo.replace(/\r\n/g, '\n').trim().slice(0, 4000)
  if (!texto) return null

  return {
    de,
    nombre:    typeof p?.FromFull?.Name === 'string' && p.FromFull.Name.trim() ? p.FromFull.Name.trim().slice(0, 80) : null,
    asunto:    typeof p?.Subject === 'string' ? p.Subject.trim().slice(0, 200) : '',
    texto,
    messageId: typeof p?.MessageID === 'string' ? p.MessageID : null,
  }
}

/** "Re: …" sin acumular "Re: Re: Re:". */
export function asuntoRespuesta(asunto: string): string {
  const base = asunto.replace(/^(\s*(re|rv|fw|fwd)\s*:\s*)+/i, '').trim()
  return `Re: ${base || 'Tu mensaje a la campaña'}`
}

/** El proveedor SMTP manda HTML: el texto del agente o del equipo se escapa y los saltos de línea se respetan. */
export function textoAHtml(texto: string): string {
  const escapado = texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${escapado.replace(/\n/g, '<br>')}</div>`
}
