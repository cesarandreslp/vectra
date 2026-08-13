import { getSmtpConfig } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { SmtpForm } from './_components/smtp-form'

export default async function ConfiguracionSmtpPage() {
  await requireModuleOrRedirect('COMUNICACIONES', ['ADMIN_CAMPANA'])

  const config = await getSmtpConfig()

  return (
    <div style={{ maxWidth: '600px' }}>
      <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', color: '#0f172a' }}>
        Configuración SMTP
      </h1>
      <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
        Configura el servidor SMTP para enviar emails desde tu campaña.
        SMS y WhatsApp usan proveedores abstractos por ahora.
      </p>
      <SmtpForm initial={config} />
    </div>
  )
}
