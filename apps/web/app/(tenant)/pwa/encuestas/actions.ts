'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth-helpers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantAiKeys } from '@/lib/tenant-ai'
import { candidateMatcher } from '@/lib/encuestas/candidate-matcher'

export interface PreguntaPendiente {
  id:       string
  text:     string
  type:     'FREE_TEXT' | 'BOOLEAN' | 'SINGLE_CHOICE'
  cargo:    string
  campania: string
  opciones: { id: string; text: string }[]
}

/**
 * Preguntas de la campaña de encuesta activa que el elector logueado todavía
 * no ha respondido — para el flujo in-app (sin WhatsApp).
 */
export async function getEncuestaPendiente(): Promise<PreguntaPendiente[]> {
  // Mismos roles que puede tener cualquier sesión dentro de /pwa (ver
  // pwa/layout.tsx) — el control real de acceso es tener voterId, no el rol:
  // staff (ADMIN_CAMPANA/COORDINADOR/TESTIGO) normalmente no lo tiene y
  // recibe listas vacías en vez de un throw que rompería la pantalla.
  const session = await requireAuth(['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR'])
  if (!session.user.voterId || !session.user.activeModules.includes('ENCUESTAS')) return []

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  const campania = await db.surveyCampaign.findFirst({
    where: { tenantId: session.user.tenantId, isActive: true, isSurveyEnabled: true },
    include: {
      cargos: {
        orderBy: { order: 'asc' },
        include: { preguntas: { orderBy: { order: 'asc' }, include: { opciones: { orderBy: { order: 'asc' } } } } },
      },
    },
  })
  if (!campania) return []

  const yaRespondidas = await db.surveyResponse.findMany({
    where: { voterId: session.user.voterId },
    select: { surveyPreguntaId: true },
  })
  const respondidasIds = new Set(yaRespondidas.map((r) => r.surveyPreguntaId))

  const pendientes: PreguntaPendiente[] = []
  for (const cargo of campania.cargos) {
    for (const pregunta of cargo.preguntas) {
      if (respondidasIds.has(pregunta.id)) continue
      pendientes.push({
        id:       pregunta.id,
        text:     pregunta.text,
        type:     pregunta.type,
        cargo:    cargo.name,
        campania: campania.name,
        opciones: pregunta.opciones.map((o) => ({ id: o.id, text: o.text })),
      })
    }
  }
  return pendientes
}

type Respuesta =
  | { type: 'FREE_TEXT'; text: string }
  | { type: 'BOOLEAN'; text: 'SI' | 'NO' }
  | { type: 'SINGLE_CHOICE'; opcionId: string }

/** Guarda la respuesta del elector logueado a una pregunta de encuesta. */
export async function responderPreguntaApp(preguntaId: string, respuesta: Respuesta) {
  const session = await requireAuth(['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR'])
  if (!session.user.voterId) return { success: false, error: 'Cuenta sin elector enlazado.' }

  const db = getTenantDb(await getTenantConnection(session.user.tenantId))

  const pregunta = await db.surveyPregunta.findFirst({
    where: { id: preguntaId, cargo: { campaign: { tenantId: session.user.tenantId } } },
    include: { cargo: { include: { candidatos: true } }, opciones: true },
  })
  if (!pregunta) return { success: false, error: 'Pregunta no encontrada.' }
  if (pregunta.type !== respuesta.type) return { success: false, error: 'Tipo de respuesta inválido.' }

  let text: string
  let surveyCandidatoId: string | null = null
  let surveyOpcionId: string | null = null

  if (respuesta.type === 'FREE_TEXT') {
    text = respuesta.text.trim()
    if (!text) return { success: false, error: 'Respuesta vacía.' }
    if (pregunta.cargo.candidatos.length > 0) {
      const { groq } = await getTenantAiKeys(session.user.tenantId)
      surveyCandidatoId = await candidateMatcher.matchCandidate(text, pregunta.cargo.candidatos, groq)
    }
  } else if (respuesta.type === 'BOOLEAN') {
    text = respuesta.text
  } else {
    const opcion = pregunta.opciones.find((o) => o.id === respuesta.opcionId)
    if (!opcion) return { success: false, error: 'Opción inválida.' }
    text = opcion.text
    surveyOpcionId = opcion.id
  }

  await db.surveyResponse.upsert({
    where:  { voterId_surveyPreguntaId: { voterId: session.user.voterId, surveyPreguntaId: preguntaId } },
    create: {
      tenantId: session.user.tenantId,
      voterId: session.user.voterId,
      surveyPreguntaId: preguntaId,
      text, surveyCandidatoId, surveyOpcionId,
    },
    update: { text, surveyCandidatoId, surveyOpcionId },
  })

  revalidatePath('/pwa/encuestas')
  revalidatePath('/pwa')
  return { success: true }
}
