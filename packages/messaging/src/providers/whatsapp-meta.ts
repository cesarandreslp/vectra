import type { MessagingProvider, MessagePayload, SendResult } from '../types'

/**
 * Proveedor de WhatsApp usando la API Cloud de Meta (Graph API).
 * Requiere un token de acceso y un phone_number_id válido configurado
 * a nivel de tenant.
 */
export class WhatsappMetaProvider implements MessagingProvider {
  channel = 'WHATSAPP' as const
  name = 'WhatsApp Meta Cloud API'

  constructor(
    private token: string,
    private phoneNumberId: string
  ) {}

  async send(payload: MessagePayload): Promise<SendResult> {
    if (payload.channel !== 'WHATSAPP') {
      return {
        success: false,
        error: 'Este proveedor solo soporta el canal WHATSAPP',
      }
    }

    // Normalizar el número para Colombia si es de 10 dígitos
    let phone = payload.to.replace(/\D/g, '')
    if (phone.length === 10) {
      phone = '57' + phone
    }

    try {
      const url = `https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`
      const body = payload.templateName
        ? {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            template: {
              name: payload.templateName,
              // ponytail: idioma fijo; si la campaña aprueba la plantilla en otra variante (es_MX…), hay que hacerlo configurable.
              language: { code: 'es' },
              ...(payload.templateParams?.length
                ? { components: [{ type: 'body', parameters: payload.templateParams.map((text) => ({ type: 'text', text })) }] }
                : {}),
            },
          }
        : {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: payload.body },
          }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const errMsg = errData.error?.message || `Error HTTP ${res.status}`
        return {
          success: false,
          error: errMsg,
        }
      }

      const data = await res.json()
      // La API de Meta devuelve data.messages[0].id
      const msgId = data.messages?.[0]?.id || undefined

      return {
        success: true,
        providerMsgId: msgId,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error desconocido de red',
      }
    }
  }
}
