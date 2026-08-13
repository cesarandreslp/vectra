/**
 * Proveedor de email real vía SMTP usando nodemailer.
 * El password se descifra justo antes de crear el transporter.
 */

import { createTransport } from 'nodemailer'
import { decrypt } from '@vectra/db'
import type { MessagingProvider, MessagePayload, SendResult, SmtpConfig } from '../types'

export class SmtpEmailProvider implements MessagingProvider {
  channel = 'EMAIL' as const
  name = 'smtp'

  constructor(private config: SmtpConfig) {}

  async send(payload: MessagePayload): Promise<SendResult> {
    try {
      const password = decrypt(this.config.passwordEncrypted)

      const transporter = createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: password,
        },
      })

      const info = await transporter.sendMail({
        from: this.config.from,
        to: payload.to,
        subject: payload.subject ?? '(sin asunto)',
        html: payload.body,
      })

      return {
        success: true,
        providerMsgId: info.messageId,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
