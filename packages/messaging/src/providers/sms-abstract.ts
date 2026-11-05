/**
 * Proveedor SMS abstracto (mock) para desarrollo.
 * Sin proveedor real: registra el intento y FALLA, para que nada figure como enviado sin serlo.
 * TODO: reemplazar con proveedor real (Twilio, Masivapp, etc.)
 */

import type { MessagingProvider, MessagePayload, SendResult } from '../types'

export class AbstractSmsProvider implements MessagingProvider {
  channel = 'SMS' as const
  name = 'abstract-sms'

  async send(payload: MessagePayload): Promise<SendResult> {
    console.log(
      '[SMS-MOCK] Sin proveedor. Para: ···' + payload.to.slice(-4),
      '| Mensaje:', payload.body.substring(0, 50)
    )
    // Antes devolvía éxito simulado y la campaña quedaba ENVIADA sin que saliera nada.
    return { success: false, error: 'No hay proveedor de SMS contratado: el mensaje no se envió.' }
  }
}
