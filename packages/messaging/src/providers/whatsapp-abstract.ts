/**
 * Proveedor WhatsApp abstracto (mock) para desarrollo.
 * Sin proveedor real: registra el intento y FALLA, para que nada figure como enviado sin serlo.
 * TODO: reemplazar con proveedor real (WhatsApp Business API, etc.)
 */

import type { MessagingProvider, MessagePayload, SendResult } from '../types'

export class AbstractWhatsappProvider implements MessagingProvider {
  channel = 'WHATSAPP' as const
  name = 'abstract-whatsapp'

  async send(payload: MessagePayload): Promise<SendResult> {
    console.log(
      '[WA-MOCK] Sin conexión. Para: ···' + payload.to.slice(-4),
      '| Mensaje:', payload.body.substring(0, 50)
    )
    // Antes devolvía éxito simulado y la campaña quedaba ENVIADA sin que saliera nada.
    return { success: false, error: 'WhatsApp no está conectado para esta campaña: el mensaje no se envió.' }
  }
}
