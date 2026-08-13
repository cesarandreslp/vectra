import { getTenantDb } from '@vectra/db'
import { sendMessage } from '@vectra/messaging'
import { candidateMatcher } from './candidate-matcher'
import { getTenantAiKeys } from '@/lib/tenant-ai'

const processingMessages = new Set<string>()

export class ConversationEngine {
  /**
   * Recibe un mensaje entrante y avanza la máquina de estados.
   */
  async processIncomingMessage(
    fromPhone: string,
    text: string,
    messageId: string,
    tenantId: string,
    tenantDb: ReturnType<typeof getTenantDb>,
    whatsappToken?: string,
    whatsappPhoneId?: string
  ) {
    console.log(`[ENGINE] processIncomingMessage: from=${fromPhone} text="${text}" tenantId=${tenantId}`)

    // 0. Deduplicación en memoria
    if (messageId) {
      if (processingMessages.has(messageId)) {
        console.log(`[ENGINE] messageId ${messageId} already in progress — skipping.`)
        return
      }
      processingMessages.add(messageId)
      setTimeout(() => processingMessages.delete(messageId), 60000)

      const existing = await tenantDb.surveyMessageLog.findFirst({
        where: { messageId }
      })
      if (existing) {
        console.log(`[ENGINE] Duplicate messageId ${messageId} — skipping.`)
        processingMessages.delete(messageId)
        return
      }
    }

    // 1. Normalizar teléfono
    let normalizedPhone = fromPhone.replace(/\+/g, '').replace(/\s/g, '')
    if (normalizedPhone.startsWith('57') && normalizedPhone.length > 10) {
      normalizedPhone = normalizedPhone.substring(2)
    }

    // 2. Buscar elector activo (voter) en el tenant
    const voter = await tenantDb.voter.findFirst({
      where: { tenantId, phone: normalizedPhone },
      include: {
        surveyResponses: true,
      }
    })

    if (!voter) {
      console.warn(`[ENGINE] Voter NOT FOUND for phone: ${normalizedPhone}`)
      return
    }

    console.log(`[ENGINE] Voter FOUND: ${voter.name} (${voter.id}) | State: ${voter.conversationState}`)

    // 3. Registrar mensaje entrante
    await tenantDb.surveyMessageLog.create({
      data: {
        tenantId,
        voterId: voter.id,
        type: 'RECEIVED',
        content: text,
        messageId,
      }
    }).catch(e => console.error('[ENGINE] Log error:', e))

    const credentials = { token: whatsappToken || '', phoneId: whatsappPhoneId || '' }

    // 4. Buscar la campaña activa de encuesta
    const activeCampaign = await tenantDb.surveyCampaign.findFirst({
      where: { tenantId, isActive: true, isSurveyEnabled: true },
      include: {
        cargos: {
          orderBy: { order: 'asc' },
          include: {
            preguntas: { orderBy: { order: 'asc' } },
            candidatos: true,
          }
        }
      }
    })

    if (!activeCampaign) {
      console.log(`[ENGINE] No active survey campaign found for tenant ${tenantId}`)
      return
    }

    // 5. Máquina de estados
    switch (voter.conversationState) {
      case 'PENDIENTE':
        await this.startConversation(voter.id, normalizedPhone, tenantId, tenantDb, credentials)
        break

      case 'CONTACTADO':
      case 'CONSENTIMIENTO_PENDIENTE':
        await this.handleConsentimiento(voter, text, activeCampaign, tenantId, tenantDb, credentials)
        break

      case 'CONSENTIDO':
      case 'RESPONDIENDO':
        await this.handleRespuestas(voter, text, activeCampaign, tenantId, tenantDb, credentials)
        break

      case 'COMPLETADO':
        await this.sendMessageWithLog(voter.id, normalizedPhone, "Gracias, ya hemos registrado tus respuestas. ¡Que tengas un buen día!", tenantId, tenantDb, credentials)
        break

      case 'RECHAZADO':
        await this.sendMessageWithLog(voter.id, normalizedPhone, "Respetamos tu decisión de no participar. No te enviaremos más mensajes.", tenantId, tenantDb, credentials)
        break

      default:
        console.log(`[ENGINE] Unknown state: ${voter.conversationState}`)
    }
  }

  async startConversation(
    voterId: string,
    phone: string,
    tenantId: string,
    tenantDb: ReturnType<typeof getTenantDb>,
    credentials: { token: string, phoneId: string }
  ) {
    const config = await tenantDb.tenantConfig.findUnique({ where: { tenantId } })
    const botName = config?.botName || "Asistente Virtual"
    const fallbackMsg = `Hola, un gusto saludarte. Soy ${botName}. Estamos realizando una consulta de opinión ciudadana. ¿Nos permitirías hacerte un par de preguntas? (Responde SI o NO)`

    await tenantDb.voter.update({
      where: { id: voterId },
      data: {
        conversationState: 'CONSENTIMIENTO_PENDIENTE',
        surveyContactDate: new Date()
      }
    })

    const payloadTemplate = {
      to: phone,
      channel: 'WHATSAPP' as const,
      body: fallbackMsg,
      templateName: 'solicitud_participacion'
    }

    const whatsappConfig = { token: credentials.token, phoneNumberId: credentials.phoneId }

    // Intentar template primero
    const templateResult = await sendMessage(payloadTemplate, undefined, whatsappConfig)

    if (templateResult.success) {
      await tenantDb.surveyMessageLog.create({
        data: {
          tenantId,
          voterId,
          type: 'SENT',
          content: "[TEMPLATE: solicitud_participacion]",
          messageId: templateResult.providerMsgId,
        }
      }).catch(() => {})
      return
    }

    // Fallback a texto normal
    const payloadText = { ...payloadTemplate, templateName: undefined }
    const textResult = await sendMessage(payloadText, undefined, whatsappConfig)

    if (textResult.success) {
      await tenantDb.surveyMessageLog.create({
        data: {
          tenantId,
          voterId,
          type: 'SENT',
          content: fallbackMsg,
          messageId: textResult.providerMsgId,
        }
      }).catch(() => {})
    } else {
      console.error(`[ENGINE] Todo falló para ${phone}. Revirtiendo estado.`)
      await tenantDb.voter.update({
        where: { id: voterId },
        data: { conversationState: 'PENDIENTE' }
      })
    }
  }

  private async handleConsentimiento(
    voter: any,
    text: string,
    activeCampaign: any,
    tenantId: string,
    tenantDb: ReturnType<typeof getTenantDb>,
    credentials: { token: string, phoneId: string }
  ) {
    const normalize = text.trim().toLowerCase()

    if (normalize === "si" || normalize === "sí" || normalize === "acepto") {
      const updatedVoter = await tenantDb.voter.update({
        where: { id: voter.id },
        data: {
          consent: true,
          conversationState: 'CONSENTIDO'
        },
        include: { surveyResponses: true }
      })
      await this.handleRespuestas(updatedVoter, "", activeCampaign, tenantId, tenantDb, credentials)

    } else if (normalize === "no" || normalize === "rechazo") {
      await tenantDb.voter.update({
        where: { id: voter.id },
        data: {
          consent: false,
          conversationState: 'RECHAZADO'
        }
      })
      await this.sendMessageWithLog(voter.id, voter.phone, "Entendido. No te enviaremos más encuestas. Gracias por tu tiempo.", tenantId, tenantDb, credentials)
    } else {
      await this.sendMessageWithLog(voter.id, voter.phone, "No entendimos tu respuesta. Por favor responde únicamente SI o NO.", tenantId, tenantDb, credentials)
    }
  }

  private async handleRespuestas(
    voter: any,
    text: string,
    activeCampaign: any,
    tenantId: string,
    tenantDb: ReturnType<typeof getTenantDb>,
    credentials: { token: string, phoneId: string }
  ) {
    const todasLasPreguntas: Array<any> = []
    for (const cargo of activeCampaign.cargos) {
      for (const pregunta of cargo.preguntas) {
        todasLasPreguntas.push({
          id: pregunta.id,
          text: pregunta.text,
          cargoCandidatos: cargo.candidatos
        })
      }
    }

    const respondedIds = new Set((voter.surveyResponses ?? []).map((r: any) => r.surveyPreguntaId))
    const preguntaActual = todasLasPreguntas.find(p => !respondedIds.has(p.id))

    if (text !== "" && preguntaActual && voter.conversationState === 'RESPONDIENDO') {
      let candidatoId = null
      if (preguntaActual.cargoCandidatos.length > 0) {
        const { groq } = await getTenantAiKeys(tenantId)
        candidatoId = await candidateMatcher.matchCandidate(text, preguntaActual.cargoCandidatos, groq)
      }

      await tenantDb.surveyResponse.create({
        data: {
          tenantId,
          voterId: voter.id,
          surveyPreguntaId: preguntaActual.id,
          text: text,
          surveyCandidatoId: candidatoId
        }
      })

      const respondedIdsActualizados = new Set([...respondedIds, preguntaActual.id])
      const siguientePregunta = todasLasPreguntas.find(p => !respondedIdsActualizados.has(p.id))

      if (siguientePregunta) {
        await this.sendMessageWithLog(voter.id, voter.phone, siguientePregunta.text, tenantId, tenantDb, credentials)
      } else {
        await tenantDb.voter.update({
          where: { id: voter.id },
          data: { conversationState: 'COMPLETADO', surveyResponseDate: new Date() }
        })
        await this.sendMessageWithLog(voter.id, voter.phone, "¡Gracias! Hemos completado todas las preguntas. Tu participación es muy valiosa.", tenantId, tenantDb, credentials)
      }
      return
    }

    if (preguntaActual) {
      await tenantDb.voter.update({
        where: { id: voter.id },
        data: { conversationState: 'RESPONDIENDO' }
      })
      await this.sendMessageWithLog(voter.id, voter.phone, preguntaActual.text, tenantId, tenantDb, credentials)
    } else {
      await tenantDb.voter.update({
        where: { id: voter.id },
        data: { conversationState: 'COMPLETADO' }
      })
      await this.sendMessageWithLog(voter.id, voter.phone, "No hay preguntas configuradas para esta campaña. Gracias.", tenantId, tenantDb, credentials)
    }
  }

  private async sendMessageWithLog(
    voterId: string,
    phone: string,
    message: string,
    tenantId: string,
    tenantDb: ReturnType<typeof getTenantDb>,
    credentials: { token: string, phoneId: string }
  ) {
    const payload = {
      to: phone,
      channel: 'WHATSAPP' as const,
      body: message
    }
    const whatsappConfig = { token: credentials.token, phoneNumberId: credentials.phoneId }
    
    const result = await sendMessage(payload, undefined, whatsappConfig)
    
    if (result.success) {
      await tenantDb.surveyMessageLog.create({
        data: {
          tenantId,
          voterId,
          type: 'SENT',
          content: message,
          messageId: result.providerMsgId,
        }
      }).catch(e => console.error('[ENGINE] Log error:', e))
    } else {
      console.error(`[ENGINE] sendMessage failed for ${phone}: "${message.slice(0, 50)}"`)
    }
  }
}

export const conversationEngine = new ConversationEngine()
