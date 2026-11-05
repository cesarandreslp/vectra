/**
 * Motor del agente conversacional: recibe un mensaje de un ciudadano, le
 * responde con la voz aprobada de la campaña y aplica solo las acciones de la
 * lista cerrada de ./salida (autorización, registro, temas, escalamiento).
 * El modelo propone; acá se decide. Ver plan CampaignOS, Fase 1.
 */

import { randomUUID } from 'crypto'
import { chatGroq } from '@vectra/ai'
import { encrypt, superadminDb, type getTenantDb } from '@vectra/db'
import { getTenantAiKeys } from '@/lib/tenant-ai'
import { hashTelefono, normalizarTelefono, elegirResponsable } from '@/lib/contacto-calle'
import {
  armarPrompt, interpretarSalida, presentacion, transcripcion, normalizarLugar,
  type Conocimiento, type Contexto, type Registro, type SalidaAgente,
} from './salida'

type Db = ReturnType<typeof getTenantDb>

const RESPALDO = 'Gracias por escribirnos. En este momento no puedo responderte bien; alguien del equipo de la campaña te va a escribir.'
const HISTORIAL = 12
const EN_CURSO = ['CONTACTADO', 'CONSENTIMIENTO_PENDIENTE', 'CONSENTIDO', 'RESPONDIENDO'] as const

export interface Entrada {
  tenantId:       string
  db:             Db
  de:             string // celular tal como llega del canal
  texto:          string
  providerMsgId?: string
  enviar:         (texto: string) => Promise<{ ok: boolean; providerMsgId?: string }>
}

/** El agente responde solo si está encendido y tiene una versión aprobada de lo que puede decir. */
export async function agenteActivo(db: Db, tenantId: string): Promise<boolean> {
  const a = await db.agenteCampana.findUnique({ where: { tenantId }, select: { activo: true, aprobadoEn: true } })
  return Boolean(a?.activo && a.aprobadoEn)
}

/** Si la persona está a mitad de una encuesta por WhatsApp, la sigue atendiendo la encuesta, no el agente. */
export async function encuestaEnCurso(db: Db, tenantId: string, de: string): Promise<boolean> {
  const telefonoHash = hashTelefono(de)
  if (!telefonoHash) return false
  const [voter, encuesta] = await Promise.all([
    db.voter.findFirst({ where: { tenantId, telefonoHash, conversationState: { in: [...EN_CURSO] } }, select: { id: true } }),
    db.surveyCampaign.findFirst({ where: { tenantId, isActive: true, isSurveyEnabled: true }, select: { id: true } }),
  ])
  return Boolean(voter && encuesta)
}

export async function atender(e: Entrada): Promise<void> {
  const { db, tenantId } = e
  const telefonoHash = hashTelefono(e.de)
  if (!telefonoHash || !e.texto.trim()) return
  if (e.providerMsgId && await db.mensajeConversacion.findUnique({ where: { providerMsgId: e.providerMsgId }, select: { id: true } })) return

  const agente = await db.agenteCampana.findUnique({ where: { tenantId } })
  if (!agente?.activo || !agente.versionAprobada) return

  const voter = await db.voter.findFirst({ where: { tenantId, telefonoHash }, select: { id: true } })
  const conv = await db.conversacion.upsert({
    where:  { tenantId_canal_telefonoHash: { tenantId, canal: 'WHATSAPP', telefonoHash } },
    create: { tenantId, canal: 'WHATSAPP', telefonoHash, telefono: encrypt(normalizarTelefono(e.de)), voterId: voter?.id },
    update: { ultimoMensajeEn: new Date(), ...(voter && { voterId: voter.id }) },
  })

  let entranteId: string
  try {
    entranteId = (await db.mensajeConversacion.create({
      data: { conversacionId: conv.id, entrante: true, texto: e.texto.slice(0, 4000), providerMsgId: e.providerMsgId },
      select: { id: true },
    })).id
  } catch {
    return // el mismo providerMsgId entró en paralelo (reintento de Meta)
  }

  const historial = (await db.mensajeConversacion.findMany({
    where: { conversacionId: conv.id }, orderBy: { createdAt: 'desc' }, take: HISTORIAL, select: { entrante: true, texto: true },
  })).reverse()

  const ctx = await contexto(db, tenantId, agente.versionAprobada as unknown as Conocimiento, conv)
  let salida: SalidaAgente | null = null
  try {
    const { groq } = await getTenantAiKeys(tenantId)
    salida = interpretarSalida(await chatGroq(armarPrompt(ctx), transcripcion(historial), groq))
  } catch (err) {
    console.error('[AGENTE] Groq falló:', err instanceof Error ? err.message : err)
  }

  // ── Acciones aceptadas ─────────────────────────────────────────────────────
  let autorizado = ctx.autorizacion === 'AUTORIZO'
  if (salida?.autorizacion === 'ACEPTA' && !autorizado) {
    await db.conversacion.update({ where: { id: conv.id }, data: { autorizoEn: new Date(), rechazoEn: null } })
    autorizado = true
  } else if (salida?.autorizacion === 'RECHAZA') {
    // También revoca: la Ley 1581 deja retirar la autorización cuando quiera.
    await db.conversacion.update({ where: { id: conv.id }, data: { rechazoEn: new Date(), autorizoEn: null } })
    autorizado = false
  }
  if (salida?.temas.length) await db.mensajeConversacion.update({ where: { id: entranteId }, data: { temas: salida.temas } })
  if (salida?.registro && autorizado) await aplicarRegistro(db, tenantId, conv, salida.registro, e.de)

  const motivo = salida ? salida.escalar : 'El agente no pudo responder'
  if (motivo && !(conv.escaladaEn && !conv.atendidaEn)) {
    await db.conversacion.update({ where: { id: conv.id }, data: { escaladaEn: new Date(), escaladaMotivo: motivo, atendidaEn: null, atendidaPorId: null } })
    await avisarEscalamiento(db, tenantId, agente.escalamientoUserIds, conv.id, motivo)
  }

  // ── Respuesta ──────────────────────────────────────────────────────────────
  const primera = !(await db.mensajeConversacion.findFirst({ where: { conversacionId: conv.id, entrante: false }, select: { id: true } }))
  const cuerpo = salida?.respuesta ?? RESPALDO
  const texto = primera ? `${presentacion(ctx)}\n\n${cuerpo}` : cuerpo
  const enviado = await e.enviar(texto)
  if (!enviado.ok) {
    console.error(`[AGENTE] No se pudo enviar la respuesta de la conversación ${conv.id}`)
    return
  }
  await db.mensajeConversacion.create({
    data: { conversacionId: conv.id, entrante: false, texto, providerMsgId: enviado.providerMsgId },
  })
}

async function contexto(
  db: Db, tenantId: string, conocimiento: Conocimiento,
  conv: { autorizoEn: Date | null; rechazoEn: Date | null },
): Promise<Contexto> {
  const [config, candidato] = await Promise.all([
    db.tenantConfig.findUnique({
      where: { tenantId },
      select: { botName: true, fechaEleccion: true, electionOffice: true, electionMunicipalityDivipola: true },
    }),
    db.voter.findFirst({ where: { tenantId, isCandidate: true }, select: { name: true } }),
  ])
  const municipio = config?.electionMunicipalityDivipola
    ? await db.municipality.findFirst({ where: { divipola: config.electionMunicipalityDivipola }, select: { name: true } })
    : null
  const cargo = municipio && config?.electionOffice === 'ALCALDE' ? `la Alcaldía de ${municipio.name}`
    : municipio && config?.electionOffice === 'CONCEJAL' ? `el Concejo de ${municipio.name}`
    : null // ponytail: solo cargos municipales; los demás piden el nombre del departamento

  return {
    botName:       config?.botName || 'Asistente Virtual',
    candidato:     candidato?.name ?? 'la campaña',
    cargo,
    fechaEleccion: config?.fechaEleccion
      ? config.fechaEleccion.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' })
      : null,
    autorizacion:  conv.autorizoEn ? 'AUTORIZO' : conv.rechazoEn ? 'RECHAZO' : 'PENDIENTE',
    conocimiento,
  }
}

/**
 * Lo que la persona contó, con su autorización. Si ya es elector, solo se marca
 * si quiere ser voluntario (lo demás lo lleva su líder). Si no, queda como
 * contacto (origen CHAT) asignado al líder de su barrio, igual que los de calle;
 * se abre cuando hay nombre, porque sin nombre no hay a quién darle seguimiento.
 */
async function aplicarRegistro(
  db: Db, tenantId: string,
  conv: { id: string; voterId: string | null; contactoId: string | null },
  reg: Registro, de: string,
) {
  if (conv.voterId) {
    if (reg.voluntario) await db.voter.update({ where: { id: conv.voterId }, data: { esSimpatizante: true } })
    return
  }

  const zona = reg.barrio ? await ubicar(db, reg.barrio) : null
  if (conv.contactoId) {
    const c = await db.contactoCalle.findUnique({ where: { id: conv.contactoId }, select: { intereses: true, asignadoAId: true } })
    if (!c) return
    await db.contactoCalle.update({
      where: { id: conv.contactoId },
      data: {
        ...(reg.nombre && { nombre: reg.nombre }),
        ...(reg.apoyo && { temperatura: reg.apoyo }),
        ...(reg.voluntario && { quiereSerVoluntario: true }),
        intereses: [...new Set([...c.intereses, ...reg.intereses])].slice(0, 10),
        ...(zona && { neighborhoodId: zona.barrioId, communeId: zona.comunaId, asignadoAId: c.asignadoAId ?? zona.responsable }),
      },
    })
    return
  }

  if (!reg.nombre) return
  const candidato = await db.voter.findFirst({ where: { tenantId, isCandidate: true }, select: { id: true } })
  if (!candidato) {
    console.error(`[AGENTE] Sin candidato marcado en ${tenantId}: no hay a nombre de quién abrir el contacto.`)
    return
  }
  const telefono = normalizarTelefono(de)
  const contacto = await db.contactoCalle.create({
    data: {
      id: randomUUID(), tenantId, fecha: new Date(), anfitrionId: candidato.id, origen: 'CHAT',
      nombre: reg.nombre, telefono: encrypt(telefono), telefonoHash: hashTelefono(telefono),
      temperatura: reg.apoyo, intereses: reg.intereses, quiereSerVoluntario: reg.voluntario,
      nota: 'Llegó por WhatsApp (agente)',
      neighborhoodId: zona?.barrioId ?? null, communeId: zona?.comunaId ?? null, asignadoAId: zona?.responsable ?? null,
    },
    select: { id: true },
  })
  await db.conversacion.update({ where: { id: conv.id }, data: { contactoId: contacto.id } })
}

/** "El Carmen" → barrio, comuna y quién le hace seguimiento. Por nombre: el chat no trae GPS. */
async function ubicar(db: Db, lugar: string) {
  const buscado = normalizarLugar(lugar)
  const barrios = await db.neighborhood.findMany({ select: { id: true, name: true, liderId: true, communeId: true } })
  const barrio = barrios.find((b) => normalizarLugar(b.name) === buscado)
  if (barrio) {
    const comuna = await db.commune.findUnique({ where: { id: barrio.communeId }, select: { id: true, liderId: true } })
    return { barrioId: barrio.id, comunaId: comuna?.id ?? null, responsable: elegirResponsable({ barrioLider: barrio.liderId, comunaLider: comuna?.liderId ?? null }) }
  }
  const comunas = await db.commune.findMany({ select: { id: true, name: true, liderId: true } })
  const comuna = comunas.find((k) => normalizarLugar(k.name) === buscado)
  return comuna ? { barrioId: null, comunaId: comuna.id, responsable: comuna.liderId } : null
}

/** Avisa a los responsables que designó la campaña; sin designados, a los administradores. */
async function avisarEscalamiento(db: Db, tenantId: string, designados: string[], conversacionId: string, motivo: string) {
  const userIds = designados.length
    ? designados
    : (await superadminDb.user.findMany({ where: { tenantId, role: 'ADMIN_CAMPANA', isActive: true }, select: { id: true } })).map((u) => u.id)
  if (!userIds.length) return
  await db.notification.createMany({
    data: userIds.map((userId) => ({
      tenantId, userId, type: 'CONVERSACION_ESCALADA',
      message: `Una conversación de WhatsApp necesita a alguien del equipo: ${motivo}`,
      metadata: { conversacionId, href: `/comunicaciones/conversaciones?c=${conversacionId}` },
    })),
  })
}
