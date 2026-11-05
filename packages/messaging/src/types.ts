/**
 * Tipos compartidos para el paquete de mensajería.
 * Define las interfaces que todos los proveedores deben implementar.
 */

/** Resultado del envío de un mensaje individual */
export interface SendResult {
  success: boolean
  providerMsgId?: string
  error?: string
}

/** Payload de un mensaje a enviar */
export interface MessagePayload {
  /** Teléfono o email descifrado del destinatario */
  to: string
  /** Asunto — solo para EMAIL */
  subject?: string
  /** Cuerpo del mensaje (texto plano o HTML para email) */
  body: string
  /** Canal de envío */
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP'
  /** Solo para plantillas de WhatsApp Meta */
  templateName?: string
  /** Valores de {{1}}, {{2}}… del cuerpo de la plantilla de Meta, en orden */
  templateParams?: string[]
}

/** Interfaz que todo proveedor de mensajería debe implementar */
export interface MessagingProvider {
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP'
  name: string
  send(payload: MessagePayload): Promise<SendResult>
}

/** Configuración SMTP del tenant para envío de emails */
export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  /** Password cifrado con AES-256 — se descifra antes de crear el transporter */
  passwordEncrypted: string
  /** Dirección "From" para los emails */
  from: string
}

export interface WhatsappConfig {
  token: string
  phoneNumberId: string
}
