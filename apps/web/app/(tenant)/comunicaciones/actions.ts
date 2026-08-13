'use server'

/**
 * Server Actions del módulo COMUNICACIONES.
 * Todas las acciones verifican autenticación, rol y módulo con requireModule('COMUNICACIONES').
 * El campo `to` de Message siempre va CIFRADO — se descifra solo en el momento del envío.
 * El password SMTP siempre va CIFRADO en TenantConfig.smtpConfig.
 */

import { requireModule, requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb, Prisma, encrypt, decrypt } from '@vectra/db'
import { sendMessage, sendBatch } from '@vectra/messaging'
import type { SmtpConfig, MessagePayload } from '@vectra/messaging'
import { revalidatePath }      from 'next/cache'

// ── Helper ───────────────────────────────────────────────────────────────────

async function getDbAndSession(
  roles: Parameters<typeof requireModule>[1] = [],
  screenKey?: string,
  accion: 'view' | 'edit' = 'view',
) {
  const session  = screenKey
    ? await requireModuleOrScreen('COMUNICACIONES', roles, screenKey, accion)
    : await requireModule('COMUNICACIONES', roles)
  const tenantId = session.user.tenantId as string
  const userId   = session.user.userId
  const conn     = await getTenantConnection(tenantId)
  const db       = getTenantDb(conn)
  return { db, tenantId, userId, session }
}

// ── Tipos exportados ─────────────────────────────────────────────────────────

export interface TemplateView {
  id:        string
  name:      string
  channel:   string
  subject:   string | null
  body:      string
  variables: string[]
  isActive:  boolean
  createdAt: Date
}

export interface CampaignSummary {
  id:              string
  name:            string
  channel:         string
  status:          string
  totalRecipients: number
  totalSent:       number
  totalFailed:     number
  successRate:     number // porcentaje 0-100
  createdAt:       Date
  sentAt:          Date | null
}

export interface CampaignDetail extends CampaignSummary {
  templateName: string
  segmentFilters: Record<string, unknown>
  scheduledAt:   Date | null
  failedMessages: {
    id:         string
    recipientType: string
    status:     string
    failReason: string | null
    createdAt:  Date
  }[]
}

interface Recipient {
  id:               string
  type:             'USER' | 'VOTER'
  name:             string
  decryptedContact: string
}

export interface AutomationView {
  id:           string
  name:         string
  trigger:      string
  channel:      string
  templateId:   string
  templateName: string
  isActive:     boolean
  delayMinutes: number
  createdAt:    Date
}

export interface CampaignPreview {
  totalRecipients: number
  sampleRecipients: { name: string; type: string }[]
  templateName:    string
  templateBody:    string
}

export interface SmtpConfigView {
  host:     string
  port:     number
  secure:   boolean
  user:     string
  password: string // siempre '********' — nunca el valor real
  from:     string
}

// ── Funciones auxiliares internas ─────────────────────────────────────────────

/**
 * Renderiza un template reemplazando variables {{variable}} con datos.
 */
function renderTemplate(body: string, data: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => data[key] ?? '')
}

/**
 * Extrae las variables usadas en un body de template.
 */
function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g)
  if (!matches) return []
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))]
}

/**
 * Obtiene la configuración SMTP del tenant desde TenantConfig.
 * Retorna null si no está configurada.
 */
async function loadSmtpConfig(
  db: ReturnType<typeof getTenantDb>,
  tenantId: string
): Promise<SmtpConfig | null> {
  const config = await db.tenantConfig.findUnique({
    where: { tenantId },
    select: { smtpConfig: true },
  })
  if (!config?.smtpConfig) return null
  return config.smtpConfig as unknown as SmtpConfig
}

/**
 * Resuelve los destinatarios según los filtros de segmentación.
 * Descifra el campo de contacto (email o phone) antes de retornar.
 * NUNCA retorna la cédula.
 */
async function resolveRecipients(
  filters: Record<string, unknown>,
  channel: string,
  db: ReturnType<typeof getTenantDb>,
  tenantId: string
): Promise<Recipient[]> {
  const recipients: Recipient[] = []

  // Filtros tipados
  const leaderId        = filters.leaderId as string | undefined
  const zone            = filters.zone as string | undefined
  const commitmentStatus = filters.commitmentStatus as string | undefined
  const role            = filters.role as string | undefined
  const municipalityId  = filters.municipalityId as string | undefined

  // Para EMAIL: buscar Users con email + Voters con phone (para SMS/WA) o email
  if (channel === 'EMAIL') {
    // Usuarios del tenant
    const userWhere: Record<string, unknown> = { tenantId, isActive: true }
    if (role) userWhere.role = role

    const users = await db.user.findMany({
      where: userWhere,
      select: { id: true, name: true, email: true },
    })

    for (const u of users) {
      recipients.push({
        id: u.id,
        type: 'USER',
        name: u.name ?? u.email,
        decryptedContact: u.email, // email no está cifrado en User
      })
    }
  }

  // Voters — para cualquier canal
  const voterWhere: Record<string, unknown> = { tenantId }
  if (leaderId) voterWhere.leaderId = leaderId
  if (commitmentStatus) voterWhere.commitmentStatus = commitmentStatus
  if (municipalityId) {
    voterWhere.votingTable = { station: { municipalityId } }
  }

  // Si hay filtro de zona, filtrar por líder con esa zona
  if (zone) {
    const leadersInZone = await db.voter.findMany({
      where: { tenantId, zone },
      select: { id: true },
    })
    if (leadersInZone.length > 0) {
      voterWhere.leaderId = { in: leadersInZone.map(l => l.id) }
    } else {
      // No hay líderes en esa zona — no se agregan voters
      return recipients
    }
  }

  if (channel === 'EMAIL') {
    // Solo voters que puedan tener email (por ahora no hay campo email en Voter,
    // así que solo retornamos users para EMAIL)
  } else {
    // SMS y WHATSAPP — buscar voters con phone
    voterWhere.phone = { not: null }

    const voters = await db.voter.findMany({
      where: voterWhere,
      select: { id: true, name: true, phone: true },
    })

    for (const v of voters) {
      if (!v.phone) continue
      try {
        recipients.push({
          id: v.id,
          type: 'VOTER',
          name: v.name,
          decryptedContact: decrypt(v.phone),
        })
      } catch {
        // Si falla el descifrado, omitir este destinatario
        console.error(`[COMUNICACIONES] Error descifrando phone del voter ${v.id}`)
      }
    }
  }

  return recipients
}

// ══════════════════════════════════════════════════════════════════════════════
// PLANTILLAS
// ══════════════════════════════════════════════════════════════════════════════

export async function listTemplates(channel?: string): Promise<TemplateView[]> {
  const { db, tenantId } = await getDbAndSession()

  const where: Record<string, unknown> = { tenantId, isActive: true }
  if (channel) where.channel = channel

  const templates = await db.messageTemplate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return templates.map(t => ({
    ...t,
    variables: (t.variables as string[]) ?? [],
  }))
}

export async function listAllTemplates(): Promise<TemplateView[]> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_PLANTILLAS')

  const templates = await db.messageTemplate.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  })

  return templates.map(t => ({
    ...t,
    variables: (t.variables as string[]) ?? [],
  }))
}

export async function createTemplate(data: {
  name: string
  channel: string
  subject?: string
  body: string
}): Promise<void> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_PLANTILLAS', 'edit')

  const variables = extractVariables(data.body)

  await db.messageTemplate.create({
    data: {
      tenantId,
      name: data.name,
      channel: data.channel,
      subject: data.subject ?? null,
      body: data.body,
      variables,
    },
  })

  revalidatePath('/comunicaciones/plantillas')
}

export async function updateTemplate(
  id: string,
  data: { name?: string; subject?: string; body?: string }
): Promise<void> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_PLANTILLAS', 'edit')

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.subject !== undefined) updateData.subject = data.subject
  if (data.body !== undefined) {
    updateData.body = data.body
    updateData.variables = extractVariables(data.body)
  }

  await db.messageTemplate.update({
    where: { id, tenantId },
    data: updateData,
  })

  revalidatePath('/comunicaciones/plantillas')
}

export async function toggleTemplateActive(id: string): Promise<void> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_PLANTILLAS', 'edit')

  const template = await db.messageTemplate.findFirst({
    where: { id, tenantId },
    select: { isActive: true },
  })
  if (!template) throw new Error('Plantilla no encontrada')

  await db.messageTemplate.update({
    where: { id },
    data: { isActive: !template.isActive },
  })

  revalidatePath('/comunicaciones/plantillas')
}

export async function previewTemplate(
  templateId: string,
  sampleData: Record<string, string>
): Promise<string> {
  const { db, tenantId } = await getDbAndSession()

  const template = await db.messageTemplate.findFirst({
    where: { id: templateId, tenantId },
    select: { body: true },
  })
  if (!template) throw new Error('Plantilla no encontrada')

  return renderTemplate(template.body, sampleData)
}

// ══════════════════════════════════════════════════════════════════════════════
// CAMPAÑAS
// ══════════════════════════════════════════════════════════════════════════════

export async function createCampaign(data: {
  name: string
  channel: string
  templateId: string
  segmentFilters: Record<string, unknown>
  scheduledAt?: string | null
}): Promise<string> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_CAMPANAS', 'edit')

  // Verificar que la plantilla existe
  const template = await db.messageTemplate.findFirst({
    where: { id: data.templateId, tenantId },
  })
  if (!template) throw new Error('Plantilla no encontrada')

  // Resolver destinatarios para conteo
  const recipients = await resolveRecipients(
    data.segmentFilters,
    data.channel,
    db,
    tenantId
  )

  const status = data.scheduledAt ? 'PROGRAMADA' : 'BORRADOR'

  const campaign = await db.messageCampaign.create({
    data: {
      tenantId,
      name: data.name,
      channel: data.channel,
      templateId: data.templateId,
      segmentFilters: data.segmentFilters as Prisma.InputJsonValue,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      status,
      totalRecipients: recipients.length,
    },
  })

  revalidatePath('/comunicaciones/campanas')
  return campaign.id
}

export async function previewCampaign(campaignId: string): Promise<CampaignPreview> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_CAMPANAS')

  const campaign = await db.messageCampaign.findFirst({
    where: { id: campaignId, tenantId },
  })
  if (!campaign) throw new Error('Campaña no encontrada')

  const template = await db.messageTemplate.findFirst({
    where: { id: campaign.templateId, tenantId },
    select: { name: true, body: true },
  })

  const filters = campaign.segmentFilters as Record<string, unknown>
  const recipients = await resolveRecipients(filters, campaign.channel, db, tenantId)

  return {
    totalRecipients: recipients.length,
    sampleRecipients: recipients.slice(0, 5).map(r => ({
      name: r.name,
      type: r.type,
    })),
    templateName: template?.name ?? '(eliminada)',
    templateBody: template?.body ?? '',
  }
}

export async function previewSegment(
  channel: string,
  filters: Record<string, unknown>
): Promise<{ total: number; sample: { name: string; type: string }[] }> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_CAMPANAS')

  const recipients = await resolveRecipients(filters, channel, db, tenantId)

  return {
    total: recipients.length,
    sample: recipients.slice(0, 5).map(r => ({ name: r.name, type: r.type })),
  }
}

export async function sendCampaign(campaignId: string): Promise<void> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_CAMPANAS', 'edit')

  // Verificar que la campaña existe y está en estado válido para envío
  const campaign = await db.messageCampaign.findFirst({
    where: { id: campaignId, tenantId },
  })
  if (!campaign) throw new Error('Campaña no encontrada')
  if (!['BORRADOR', 'PROGRAMADA'].includes(campaign.status)) {
    throw new Error(`La campaña no se puede enviar — estado actual: ${campaign.status}`)
  }

  // Cargar template
  const template = await db.messageTemplate.findFirst({
    where: { id: campaign.templateId, tenantId },
  })
  if (!template) throw new Error('La plantilla de la campaña fue eliminada')

  // Cargar SMTP config si el canal es EMAIL
  let smtpConfig: SmtpConfig | undefined
  if (campaign.channel === 'EMAIL') {
    const loaded = await loadSmtpConfig(db, tenantId)
    if (!loaded) throw new Error('Configuración SMTP no encontrada. Configúrala primero.')
    smtpConfig = loaded
  }

  // Cambiar estado a ENVIANDO
  await db.messageCampaign.update({
    where: { id: campaignId },
    data: { status: 'ENVIANDO' },
  })

  // Resolver destinatarios
  const filters = campaign.segmentFilters as Record<string, unknown>
  const recipients = await resolveRecipients(filters, campaign.channel, db, tenantId)

  let totalSent   = 0
  let totalFailed = 0

  // Preparar payloads y crear registros Message en DB
  const payloads: MessagePayload[] = []
  const messageIds: string[] = []

  for (const r of recipients) {
    // Datos para renderizar el template
    const templateData: Record<string, string> = {
      nombre: r.name,
    }

    const renderedBody = renderTemplate(template.body, templateData)
    const renderedSubject = template.subject
      ? renderTemplate(template.subject, templateData)
      : undefined

    // Crear registro en DB con el campo `to` cifrado
    const msg = await db.message.create({
      data: {
        tenantId,
        campaignId,
        channel: campaign.channel,
        recipientId: r.id,
        recipientType: r.type,
        to: encrypt(r.decryptedContact),
        subject: renderedSubject ?? null,
        body: renderedBody,
        status: 'PENDIENTE',
      },
    })

    messageIds.push(msg.id)
    payloads.push({
      to: r.decryptedContact,
      subject: renderedSubject,
      body: renderedBody,
      channel: campaign.channel as 'EMAIL' | 'SMS' | 'WHATSAPP',
    })
  }

  // Enviar en batches
  const results = await sendBatch(payloads, smtpConfig, undefined, 10)

  // Actualizar cada Message con el resultado
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const msgId  = messageIds[i]

    if (result.success) {
      totalSent++
      await db.message.update({
        where: { id: msgId },
        data: {
          status: 'ENVIADO',
          provider: campaign.channel === 'EMAIL' ? 'smtp' : `abstract-${campaign.channel.toLowerCase()}`,
          providerMsgId: result.providerMsgId ?? null,
          sentAt: new Date(),
        },
      })
    } else {
      totalFailed++
      await db.message.update({
        where: { id: msgId },
        data: {
          status: 'FALLIDO',
          failReason: result.error ?? 'Error desconocido',
        },
      })
    }
  }

  // Actualizar campaña con resultados finales
  const finalStatus = totalSent === 0 && totalFailed > 0 ? 'FALLIDA' : 'COMPLETADA'

  await db.messageCampaign.update({
    where: { id: campaignId },
    data: {
      status: finalStatus,
      totalRecipients: recipients.length,
      totalSent,
      totalFailed,
      sentAt: new Date(),
    },
  })

  revalidatePath('/comunicaciones')
  revalidatePath('/comunicaciones/campanas')
}

export async function listCampaigns(filters?: {
  status?: string
  channel?: string
}): Promise<CampaignSummary[]> {
  const { db, tenantId } = await getDbAndSession()

  const where: Record<string, unknown> = { tenantId }
  if (filters?.status) where.status = filters.status
  if (filters?.channel) where.channel = filters.channel

  const campaigns = await db.messageCampaign.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return campaigns.map(c => ({
    id:              c.id,
    name:            c.name,
    channel:         c.channel,
    status:          c.status,
    totalRecipients: c.totalRecipients,
    totalSent:       c.totalSent,
    totalFailed:     c.totalFailed,
    successRate:     c.totalRecipients > 0
      ? Math.round((c.totalSent / c.totalRecipients) * 100)
      : 0,
    createdAt: c.createdAt,
    sentAt:    c.sentAt,
  }))
}

export async function getCampaignDetail(campaignId: string): Promise<CampaignDetail> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_CAMPANAS')

  const campaign = await db.messageCampaign.findFirst({
    where: { id: campaignId, tenantId },
    include: {
      messages: {
        where: { status: 'FALLIDO' },
        select: {
          id: true,
          recipientType: true,
          status: true,
          failReason: true,
          createdAt: true,
        },
        take: 50,
      },
    },
  })
  if (!campaign) throw new Error('Campaña no encontrada')

  // Cargar nombre del template
  const template = await db.messageTemplate.findFirst({
    where: { id: campaign.templateId, tenantId },
    select: { name: true },
  })

  return {
    id:              campaign.id,
    name:            campaign.name,
    channel:         campaign.channel,
    status:          campaign.status,
    totalRecipients: campaign.totalRecipients,
    totalSent:       campaign.totalSent,
    totalFailed:     campaign.totalFailed,
    successRate:     campaign.totalRecipients > 0
      ? Math.round((campaign.totalSent / campaign.totalRecipients) * 100)
      : 0,
    createdAt:      campaign.createdAt,
    sentAt:         campaign.sentAt,
    templateName:   template?.name ?? '(eliminada)',
    segmentFilters: campaign.segmentFilters as Record<string, unknown>,
    scheduledAt:    campaign.scheduledAt,
    failedMessages: campaign.messages,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTOMATIZACIONES
// ══════════════════════════════════════════════════════════════════════════════

export async function listAutomations(): Promise<AutomationView[]> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_AUTOMATIZACIONES')

  const rules = await db.automationRule.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  })

  // Cargar nombres de templates
  const templateIds = [...new Set(rules.map(r => r.templateId))]
  const templates = templateIds.length > 0
    ? await db.messageTemplate.findMany({
        where: { id: { in: templateIds }, tenantId },
        select: { id: true, name: true },
      })
    : []
  const templateMap = new Map(templates.map(t => [t.id, t.name]))

  return rules.map(r => ({
    id:           r.id,
    name:         r.name,
    trigger:      r.trigger,
    channel:      r.channel,
    templateId:   r.templateId,
    templateName: templateMap.get(r.templateId) ?? '(eliminada)',
    isActive:     r.isActive,
    delayMinutes: r.delayMinutes,
    createdAt:    r.createdAt,
  }))
}

export async function createAutomation(data: {
  name: string
  trigger: string
  channel: string
  templateId: string
  delayMinutes?: number
  conditions?: Record<string, unknown>
}): Promise<void> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_AUTOMATIZACIONES', 'edit')

  // Verificar que la plantilla existe
  const template = await db.messageTemplate.findFirst({
    where: { id: data.templateId, tenantId },
  })
  if (!template) throw new Error('Plantilla no encontrada')

  await db.automationRule.create({
    data: {
      tenantId,
      name: data.name,
      trigger: data.trigger,
      channel: data.channel,
      templateId: data.templateId,
      delayMinutes: data.delayMinutes ?? 0,
      conditions: data.conditions ? (data.conditions as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  })

  revalidatePath('/comunicaciones/automatizaciones')
}

export async function toggleAutomation(id: string): Promise<void> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_AUTOMATIZACIONES', 'edit')

  const rule = await db.automationRule.findFirst({
    where: { id, tenantId },
    select: { isActive: true },
  })
  if (!rule) throw new Error('Regla no encontrada')

  await db.automationRule.update({
    where: { id },
    data: { isActive: !rule.isActive },
  })

  revalidatePath('/comunicaciones/automatizaciones')
}

/**
 * Dispara automatizaciones para un trigger dado.
 * Función interna — será integrada en otros módulos (Core, Día E) en una tarea posterior.
 *
 * @param trigger - Tipo de evento (NUEVO_ELECTOR, CAMBIO_COMPROMISO, etc.)
 * @param context - Datos del evento (recipientName, recipientContact, etc.)
 * @param tenantId - ID del tenant
 * @param connectionString - Connection string descifrada del tenant
 */
export async function triggerAutomation(
  trigger: string,
  context: Record<string, string>,
  tenantId: string,
  connectionString: string
): Promise<void> {
  const db = getTenantDb(connectionString)

  // Buscar reglas activas para este trigger
  const rules = await db.automationRule.findMany({
    where: { tenantId, trigger, isActive: true },
  })

  if (rules.length === 0) return

  // Cargar SMTP config por si alguna regla usa EMAIL
  const smtpConfig = await loadSmtpConfig(db, tenantId)

  for (const rule of rules) {
    // Cargar template
    const template = await db.messageTemplate.findFirst({
      where: { id: rule.templateId, tenantId },
    })
    if (!template) continue

    const renderedBody = renderTemplate(template.body, context)
    const renderedSubject = template.subject
      ? renderTemplate(template.subject, context)
      : undefined

    const recipientContact = context.recipientContact
    if (!recipientContact) continue

    // Aplicar delay si está configurado
    if (rule.delayMinutes > 0) {
      await new Promise(r => setTimeout(r, rule.delayMinutes * 60 * 1000))
    }

    // Enviar
    const payload: MessagePayload = {
      to: recipientContact,
      subject: renderedSubject,
      body: renderedBody,
      channel: rule.channel as 'EMAIL' | 'SMS' | 'WHATSAPP',
    }

    let smtp: SmtpConfig | undefined
    if (rule.channel === 'EMAIL') {
      if (!smtpConfig) continue
      smtp = smtpConfig
    }

    const result = await sendMessage(payload, smtp)

    // Registrar el mensaje en DB
    await db.message.create({
      data: {
        tenantId,
        channel: rule.channel,
        recipientId: context.recipientId ?? 'unknown',
        recipientType: context.recipientType ?? 'VOTER',
        to: encrypt(recipientContact),
        subject: renderedSubject ?? null,
        body: renderedBody,
        status: result.success ? 'ENVIADO' : 'FALLIDO',
        provider: result.success ? (rule.channel === 'EMAIL' ? 'smtp' : `abstract-${rule.channel.toLowerCase()}`) : null,
        providerMsgId: result.providerMsgId ?? null,
        sentAt: result.success ? new Date() : null,
        failReason: result.error ?? null,
      },
    })
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN SMTP
// ══════════════════════════════════════════════════════════════════════════════

export async function getSmtpConfig(): Promise<SmtpConfigView | null> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_CONFIGURACION')

  const config = await db.tenantConfig.findUnique({
    where: { tenantId },
    select: { smtpConfig: true },
  })

  if (!config?.smtpConfig) return null
  const smtp = config.smtpConfig as unknown as SmtpConfig

  return {
    host:     smtp.host,
    port:     smtp.port,
    secure:   smtp.secure,
    user:     smtp.user,
    password: '********', // NUNCA retornar el password real
    from:     smtp.from,
  }
}

export async function updateSmtpConfig(data: {
  host: string
  port: number
  secure: boolean
  user: string
  password?: string // solo se actualiza si se provee (no '********')
  from: string
}): Promise<void> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_CONFIGURACION', 'edit')

  // Cargar config existente para preservar el password si no se actualiza
  const existing = await db.tenantConfig.findUnique({
    where: { tenantId },
    select: { smtpConfig: true },
  })

  let passwordEncrypted: string
  if (data.password && data.password !== '********') {
    passwordEncrypted = encrypt(data.password)
  } else if (existing?.smtpConfig) {
    const prev = existing.smtpConfig as unknown as SmtpConfig
    passwordEncrypted = prev.passwordEncrypted
  } else {
    throw new Error('Se requiere un password para la primera configuración SMTP.')
  }

  const smtpConfig: SmtpConfig = {
    host: data.host,
    port: data.port,
    secure: data.secure,
    user: data.user,
    passwordEncrypted,
    from: data.from,
  }

  await db.tenantConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      smtpConfig: smtpConfig as unknown as Prisma.InputJsonValue,
    },
    update: {
      smtpConfig: smtpConfig as unknown as Prisma.InputJsonValue,
    },
  })

  revalidatePath('/comunicaciones/configuracion')
}

export async function testSmtpConnection(testEmail: string): Promise<{
  success: boolean
  error?: string
}> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'COMUNICACIONES_CONFIGURACION', 'edit')

  const config = await loadSmtpConfig(db, tenantId)
  if (!config) {
    return { success: false, error: 'Configuración SMTP no encontrada. Guárdala primero.' }
  }

  const result = await sendMessage(
    {
      to: testEmail,
      subject: 'Prueba de conexión SMTP — Vectra',
      body: '<p>Este es un email de prueba enviado desde Vectra para verificar tu configuración SMTP.</p><p>Si recibes este mensaje, la configuración es correcta.</p>',
      channel: 'EMAIL',
    },
    config
  )

  return result.success
    ? { success: true }
    : { success: false, error: result.error }
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD — MÉTRICAS
// ══════════════════════════════════════════════════════════════════════════════

export async function getDashboardMetrics(): Promise<{
  totalSent:         number
  totalFailed:       number
  successRate:       number
  activeCampaigns:   number
  thisWeekSent:      number
  recentCampaigns:   CampaignSummary[]
}> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'COMUNICACIONES_DASHBOARD')

  // Métricas globales de mensajes
  const [sentCount, failedCount] = await Promise.all([
    db.message.count({ where: { tenantId, status: 'ENVIADO' } }),
    db.message.count({ where: { tenantId, status: 'FALLIDO' } }),
  ])

  const totalMessages = sentCount + failedCount
  const successRate = totalMessages > 0 ? Math.round((sentCount / totalMessages) * 100) : 0

  // Campañas activas (ENVIANDO o PROGRAMADA)
  const activeCampaigns = await db.messageCampaign.count({
    where: { tenantId, status: { in: ['ENVIANDO', 'PROGRAMADA'] } },
  })

  // Mensajes esta semana
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const thisWeekSent = await db.message.count({
    where: { tenantId, status: 'ENVIADO', sentAt: { gte: weekAgo } },
  })

  // Últimas 5 campañas
  const campaigns = await db.messageCampaign.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  const recentCampaigns: CampaignSummary[] = campaigns.map(c => ({
    id:              c.id,
    name:            c.name,
    channel:         c.channel,
    status:          c.status,
    totalRecipients: c.totalRecipients,
    totalSent:       c.totalSent,
    totalFailed:     c.totalFailed,
    successRate:     c.totalRecipients > 0
      ? Math.round((c.totalSent / c.totalRecipients) * 100)
      : 0,
    createdAt: c.createdAt,
    sentAt:    c.sentAt,
  }))

  return {
    totalSent: sentCount,
    totalFailed: failedCount,
    successRate,
    activeCampaigns,
    thisWeekSent,
    recentCampaigns,
  }
}
