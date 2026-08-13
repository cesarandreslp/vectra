/**
 * Punto de entrada del paquete @vectra/messaging.
 * Re-exporta tipos, proveedores y dispatcher.
 */

// Tipos
export type {
  SendResult,
  MessagePayload,
  MessagingProvider,
  SmtpConfig,
} from './types'

// Proveedores
export { SmtpEmailProvider } from './providers/email-smtp'
export { AbstractSmsProvider } from './providers/sms-abstract'
export { AbstractWhatsappProvider } from './providers/whatsapp-abstract'

// Dispatcher
export { getProvider, sendMessage, sendBatch } from './dispatcher'
