import type { getTenantDb } from '@vectra/db'
import type { SmtpConfig } from '@vectra/messaging'

/** SMTP de la campaña (TenantConfig.smtpConfig, con la clave cifrada adentro). null = sin configurar. */
export async function cargarSmtp(db: ReturnType<typeof getTenantDb>, tenantId: string): Promise<SmtpConfig | null> {
  const config = await db.tenantConfig.findUnique({ where: { tenantId }, select: { smtpConfig: true } })
  return (config?.smtpConfig as unknown as SmtpConfig | null) ?? null
}

/** Las direcciones de la propia campaña: "Campaña <hola@x.co>" → hola@x.co, más el usuario SMTP. */
export function direccionesDe(smtp: SmtpConfig | null): string[] {
  if (!smtp) return []
  const enFrom = /<([^>]+)>/.exec(smtp.from)?.[1] ?? smtp.from
  return [enFrom, smtp.user].filter((d) => d?.includes('@'))
}
