'use server'

/**
 * Bandeja de conversaciones del agente: el equipo ve lo que se habló, atiende
 * lo que el agente escaló y puede responder como persona.
 */

import { revalidatePath } from 'next/cache'
import { getTenantDb, decrypt } from '@vectra/db'
import { sendMessage } from '@vectra/messaging'
import { getTenantConnection } from '@/lib/tenant'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { enviarTelegram } from '@/lib/telegram'
import { cargarSmtp } from '@/lib/smtp'
import { textoAHtml } from '@/lib/correo-entrada'

export interface FilaConversacion {
  id:              string
  canal:           string // WHATSAPP | TELEGRAM | EMAIL
  nombre:          string
  telefonoFinal:   string // últimos 4 dígitos
  ultimoMensajeEn: string
  pendiente:       boolean // escalada y sin atender
  motivo:          string | null
  autorizo:        boolean
}

export interface DetalleConversacion extends FilaConversacion {
  telefono:   string
  voterId:    string | null
  atendida:   string | null
  mensajes:   { id: string; entrante: boolean; texto: string; humano: boolean; temas: string[]; createdAt: string }[]
}

type Resultado = { success: true } | { success: false; error: string }

async function sesionYDb(accion: 'view' | 'edit') {
  const session  = await requireModuleOrScreen('COMUNICACIONES', ['ADMIN_CAMPANA', 'COORDINADOR'], 'COMUNICACIONES_CONVERSACIONES', accion)
  const tenantId = session.user.tenantId
  return { session, tenantId, db: getTenantDb(await getTenantConnection(tenantId)) }
}

type Db = Awaited<ReturnType<typeof sesionYDb>>['db']

/** Nombre a mostrar: el del elector si ya lo es, el que dio en el chat si no. */
async function nombres(db: Db, convs: { voterId: string | null; contactoId: string | null }[]) {
  const voterIds = convs.map((c) => c.voterId).filter((x): x is string => Boolean(x))
  const contactoIds = convs.map((c) => c.contactoId).filter((x): x is string => Boolean(x))
  const [voters, contactos] = await Promise.all([
    voterIds.length ? db.voter.findMany({ where: { id: { in: voterIds } }, select: { id: true, name: true } }) : [],
    contactoIds.length ? db.contactoCalle.findMany({ where: { id: { in: contactoIds } }, select: { id: true, nombre: true } }) : [],
  ])
  const v = new Map(voters.map((x) => [x.id, x.name]))
  const k = new Map(contactos.map((x) => [x.id, x.nombre]))
  return (c: { voterId: string | null; contactoId: string | null }) =>
    (c.voterId && v.get(c.voterId)) || (c.contactoId && k.get(c.contactoId)) || 'Sin nombre'
}

function ultimos4(cifrado: string): string {
  try { return decrypt(cifrado).slice(-4) } catch { return '????' }
}

export async function listConversaciones(soloPendientes: boolean): Promise<FilaConversacion[]> {
  const { tenantId, db } = await sesionYDb('view')
  const convs = await db.conversacion.findMany({
    where:   { tenantId, ...(soloPendientes && { escaladaEn: { not: null }, atendidaEn: null }) },
    orderBy: { ultimoMensajeEn: 'desc' },
    take:    200,
  })
  const nombreDe = await nombres(db, convs)
  return convs
    .map((c) => ({
      id: c.id, canal: c.canal, nombre: nombreDe(c), telefonoFinal: ultimos4(c.telefono), ultimoMensajeEn: c.ultimoMensajeEn.toISOString(),
      pendiente: Boolean(c.escaladaEn && !c.atendidaEn), motivo: c.escaladaMotivo, autorizo: Boolean(c.autorizoEn),
    }))
    .sort((a, b) => Number(b.pendiente) - Number(a.pendiente)) // las que esperan a alguien, arriba
}

export async function getConversacion(id: string): Promise<DetalleConversacion | null> {
  const { tenantId, db } = await sesionYDb('view')
  const c = await db.conversacion.findFirst({
    where:   { id, tenantId },
    include: { mensajes: { orderBy: { createdAt: 'asc' }, take: 300 } },
  })
  if (!c) return null
  const nombreDe = await nombres(db, [c])
  let telefono = ''
  try { telefono = decrypt(c.telefono) } catch { /* queda vacío */ }
  return {
    id: c.id, canal: c.canal, nombre: nombreDe(c), telefono, telefonoFinal: telefono.slice(-4), voterId: c.voterId,
    ultimoMensajeEn: c.ultimoMensajeEn.toISOString(), pendiente: Boolean(c.escaladaEn && !c.atendidaEn),
    motivo: c.escaladaMotivo, autorizo: Boolean(c.autorizoEn), atendida: c.atendidaEn?.toISOString() ?? null,
    mensajes: c.mensajes.map((m) => ({
      id: m.id, entrante: m.entrante, texto: m.texto, humano: Boolean(m.autorId), temas: m.temas, createdAt: m.createdAt.toISOString(),
    })),
  }
}

/** Una persona del equipo le escribe por el mismo canal. WhatsApp solo deja texto libre dentro de las 24 h del último mensaje de la persona. */
export async function responderConversacion(id: string, texto: string): Promise<Resultado> {
  const { session, tenantId, db } = await sesionYDb('edit')
  const cuerpo = typeof texto === 'string' ? texto.trim().slice(0, 1000) : ''
  if (!cuerpo) return { success: false, error: 'Escribe la respuesta.' }

  const [c, config] = await Promise.all([
    db.conversacion.findFirst({ where: { id, tenantId }, select: { id: true, telefono: true, canal: true } }),
    db.tenantConfig.findUnique({ where: { tenantId }, select: { whatsappToken: true, whatsappPhoneId: true, telegramBotToken: true } }),
  ])
  if (!c) return { success: false, error: 'Conversación no encontrada.' }

  if (c.canal === 'EMAIL') {
    const smtp = await cargarSmtp(db, tenantId)
    if (!smtp) return { success: false, error: 'El correo de la campaña (SMTP) no está configurado.' }
    const m = await sendMessage({ to: decrypt(c.telefono), channel: 'EMAIL', subject: 'Respuesta de la campaña', body: textoAHtml(cuerpo) }, smtp)
    if (!m.success) return { success: false, error: `El correo no salió (${m.error}).` }
    await db.mensajeConversacion.create({
      data: { conversacionId: c.id, entrante: false, texto: cuerpo, autorId: session.user.userId, providerMsgId: m.providerMsgId },
    })
    revalidatePath('/comunicaciones/conversaciones')
    return { success: true }
  }

  if (c.canal === 'TELEGRAM') {
    if (!config?.telegramBotToken) return { success: false, error: 'El bot de Telegram no está conectado.' }
    const t = await enviarTelegram(decrypt(config.telegramBotToken), decrypt(c.telefono), cuerpo)
    if (!t.ok) return { success: false, error: `Telegram no lo entregó (${t.error}). Si la persona bloqueó el bot, ya no se le puede escribir.` }
    await db.mensajeConversacion.create({
      data: { conversacionId: c.id, entrante: false, texto: cuerpo, autorId: session.user.userId, providerMsgId: t.providerMsgId },
    })
    revalidatePath('/comunicaciones/conversaciones')
    return { success: true }
  }

  if (!config?.whatsappToken || !config.whatsappPhoneId) return { success: false, error: 'WhatsApp no está conectado.' }
  const r = await sendMessage(
    { to: decrypt(c.telefono), channel: 'WHATSAPP', body: cuerpo }, undefined,
    { token: decrypt(config.whatsappToken), phoneNumberId: config.whatsappPhoneId },
  )
  if (!r.success) {
    return { success: false, error: `WhatsApp no lo entregó (${r.error}). Si pasaron más de 24 horas desde su último mensaje, WhatsApp solo deja enviar plantillas aprobadas.` }
  }
  await db.mensajeConversacion.create({
    data: { conversacionId: c.id, entrante: false, texto: cuerpo, autorId: session.user.userId, providerMsgId: r.providerMsgId },
  })
  revalidatePath('/comunicaciones/conversaciones')
  return { success: true }
}

export async function marcarAtendida(id: string): Promise<Resultado> {
  const { session, tenantId, db } = await sesionYDb('edit')
  const { count } = await db.conversacion.updateMany({
    where: { id, tenantId, escaladaEn: { not: null }, atendidaEn: null },
    data:  { atendidaEn: new Date(), atendidaPorId: session.user.userId },
  })
  if (!count) return { success: false, error: 'No había nada pendiente en esa conversación.' }
  revalidatePath('/comunicaciones/conversaciones')
  return { success: true }
}
