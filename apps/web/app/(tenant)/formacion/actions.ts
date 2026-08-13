'use server'

/**
 * Server Actions del módulo FORMACION.
 * Todas las acciones:
 *   - Verifican autenticación, rol y módulo con requireModule('FORMACION')
 *   - Obtienen la DB del tenant via getTenantConnection()
 *   - correctIndex de QuizQuestion NUNCA se envía al cliente
 */

import { requireModule, requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb, superadminDb } from '@vectra/db'
import { put }                 from '@vercel/blob'
import { revalidatePath }      from 'next/cache'

// ── Helper ───────────────────────────────────────────────────────────────────

async function getDbAndSession(
  roles: Parameters<typeof requireModule>[1] = [],
  screenKey?: string,
  accion: 'view' | 'edit' = 'view',
) {
  const session  = screenKey
    ? await requireModuleOrScreen('FORMACION', roles, screenKey, accion)
    : await requireModule('FORMACION', roles)
  const tenantId = session.user.tenantId as string
  const userId   = session.user.userId
  const conn     = await getTenantConnection(tenantId)
  const db       = getTenantDb(conn)
  return { db, tenantId, userId, session }
}

// ── Tipos exportados ─────────────────────────────────────────────────────────

export interface MaterialView {
  id:          string
  title:       string
  description: string | null
  type:        string
  fileUrl:     string
  fileSize:    number | null
  order:       number
  source:      'global' | 'tenant'
}

export interface SessionSummary {
  id:          string
  title:       string
  description: string | null
  date:        Date
  location:    string | null
  maxCapacity: number | null
  inscribed:   number
  isActive:    boolean
}

export interface SessionDetail extends SessionSummary {
  attendees: {
    userId:   string
    email:    string
    name:     string | null
    attended: boolean
  }[]
}

export interface QuizSummary {
  id:           string
  title:        string
  description:  string | null
  passingScore: number
  questionCount: number
  isActive:     boolean
  bestScore:    number | null  // null si el usuario no ha intentado
  passed:       boolean
}

export interface QuizForUser {
  id:           string
  title:        string
  description:  string | null
  passingScore: number
  questions:    {
    id:      string
    text:    string
    options: string[]
    // correctIndex NO incluido — seguridad server-side
  }[]
}

export interface QuizAttemptResult {
  score:  number
  passed: boolean
  total:  number
  correct: number
}

export interface CertificateView {
  id:        string
  quizTitle: string
  pdfUrl:    string
  issuedAt:  Date
}

export interface WitnessProgress {
  userId:             string
  email:              string
  name:               string | null
  sessionsAttended:   number
  quizzesAttempted:   number
  quizzesPassed:      number
  certificatesEarned: number
  avgScore:           number | null
}

export interface FormacionMetrics {
  totalMaterials:    number
  totalSessions:     number
  totalQuizzes:      number
  totalCertificates: number
  totalWitnesses:    number
  avgPassRate:       number | null
}

// ── MATERIALES ───────────────────────────────────────────────────────────────

/**
 * Lista materiales combinando globales (primero) + propios del tenant.
 * Materiales globales ocultos por el tenant se excluyen.
 * Orden: globales por customOrder/order, luego tenant por order.
 */
export async function listMaterials(): Promise<MaterialView[]> {
  const { db, tenantId } = await getDbAndSession()

  // Materiales globales activos desde superadmin DB
  const globals = await superadminDb.globalTrainingMaterial.findMany({
    where:   { isActive: true },
    orderBy: { order: 'asc' },
  })

  // Preferencias del tenant sobre materiales globales
  const prefs = await db.tenantMaterialPreference.findMany({
    where: { tenantId },
  })
  const prefsMap = new Map(prefs.map(p => [p.globalMaterialId, p]))

  // Filtrar globales ocultos y mapear
  const globalesFiltrados: MaterialView[] = globals
    .filter(g => {
      const pref = prefsMap.get(g.id)
      return !pref?.isHidden
    })
    .map(g => {
      const pref = prefsMap.get(g.id)
      return {
        id:          g.id,
        title:       g.title,
        description: g.description,
        type:        g.type,
        fileUrl:     g.fileUrl,
        fileSize:    g.fileSize,
        order:       pref?.customOrder ?? g.order,
        source:      'global' as const,
      }
    })
    .sort((a, b) => a.order - b.order)

  // Materiales propios del tenant
  const locales = await db.trainingMaterial.findMany({
    where:   { tenantId, isActive: true },
    orderBy: { order: 'asc' },
  })

  const localesMapped: MaterialView[] = locales.map(m => ({
    id:          m.id,
    title:       m.title,
    description: m.description,
    type:        m.type,
    fileUrl:     m.fileUrl,
    fileSize:    m.fileSize,
    order:       m.order,
    source:      'tenant' as const,
  }))

  // Globales PRIMERO, luego propios del tenant
  return [...globalesFiltrados, ...localesMapped]
}

/**
 * Lista todos los materiales para admin (incluye inactivos y visibilidad global).
 */
export async function listMaterialsAdmin(): Promise<(MaterialView & { isActive: boolean })[]> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'FORMACION_MATERIALES')

  const locales = await db.trainingMaterial.findMany({
    where:   { tenantId },
    orderBy: { order: 'asc' },
  })

  return locales.map(m => ({
    id:          m.id,
    title:       m.title,
    description: m.description,
    type:        m.type,
    fileUrl:     m.fileUrl,
    fileSize:    m.fileSize,
    order:       m.order,
    isActive:    m.isActive,
    source:      'tenant' as const,
  }))
}

/** Crea un material propio del tenant. Sube archivo a Vercel Blob. */
export async function createMaterial(formData: FormData): Promise<
  { success: true; id: string } | { success: false; error: string }
> {
  try {
    const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'FORMACION_MATERIALES', 'edit')

    const title       = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const type        = formData.get('type') as string
    const file        = formData.get('file') as File | null
    const externalUrl = (formData.get('externalUrl') as string) || null

    if (!title || !type) {
      return { success: false, error: 'Título y tipo son obligatorios.' }
    }

    let fileUrl: string
    let fileSize: number | null = null

    if (file && file.size > 0) {
      const blob = await put(`formacion/${tenantId}/${file.name}`, file, { access: 'public' })
      fileUrl  = blob.url
      fileSize = file.size
    } else if (externalUrl) {
      fileUrl = externalUrl
    } else {
      return { success: false, error: 'Debe seleccionar un archivo o ingresar una URL externa.' }
    }

    const maxOrder = await db.trainingMaterial.aggregate({
      where: { tenantId },
      _max:  { order: true },
    })

    const material = await db.trainingMaterial.create({
      data: {
        tenantId,
        title,
        description,
        type,
        fileUrl,
        fileSize,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    })

    revalidatePath('/formacion')
    return { success: true, id: material.id }
  } catch (err) {
    console.error('[createMaterial]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al crear el material.' }
  }
}

/** Toggle activo/inactivo de un material del tenant */
export async function toggleMaterial(id: string): Promise<void> {
  const { db } = await getDbAndSession(['ADMIN_CAMPANA'], 'FORMACION_MATERIALES', 'edit')
  const actual = await db.trainingMaterial.findUnique({ where: { id }, select: { isActive: true } })
  if (!actual) return
  await db.trainingMaterial.update({ where: { id }, data: { isActive: !actual.isActive } })
  revalidatePath('/formacion')
}

/** Elimina un material del tenant */
export async function deleteMaterial(id: string): Promise<void> {
  const { db } = await getDbAndSession(['ADMIN_CAMPANA'], 'FORMACION_MATERIALES', 'edit')
  await db.trainingMaterial.delete({ where: { id } })
  revalidatePath('/formacion')
}

/** Oculta o muestra un material global para este tenant */
export async function toggleGlobalMaterialVisibility(globalMaterialId: string): Promise<void> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'FORMACION_MATERIALES', 'edit')

  const existing = await db.tenantMaterialPreference.findUnique({
    where: { tenantId_globalMaterialId: { tenantId, globalMaterialId } },
  })

  if (existing) {
    await db.tenantMaterialPreference.update({
      where: { id: existing.id },
      data:  { isHidden: !existing.isHidden },
    })
  } else {
    await db.tenantMaterialPreference.create({
      data: { tenantId, globalMaterialId, isHidden: true },
    })
  }
  revalidatePath('/formacion')
}

// ── SESIONES ─────────────────────────────────────────────────────────────────

/** Lista sesiones de capacitación */
export async function listSessions(): Promise<SessionSummary[]> {
  const { db, tenantId } = await getDbAndSession()

  const sessions = await db.trainingSession.findMany({
    where:   { tenantId, isActive: true },
    orderBy: { date: 'desc' },
    include: { attendances: { select: { id: true } } },
  })

  return sessions.map(s => ({
    id:          s.id,
    title:       s.title,
    description: s.description,
    date:        s.date,
    location:    s.location,
    maxCapacity: s.maxCapacity,
    inscribed:   s.attendances.length,
    isActive:    s.isActive,
  }))
}

/** Detalle de una sesión con lista de asistentes */
export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const { db, tenantId } = await getDbAndSession()

  const s = await db.trainingSession.findUnique({
    where:   { id: sessionId },
    include: { attendances: true },
  })

  if (!s || s.tenantId !== tenantId) return null

  // Obtener datos de usuarios
  const userIds = s.attendances.map(a => a.userId)
  const users = userIds.length > 0
    ? await db.user.findMany({
        where:  { id: { in: userIds } },
        select: { id: true, email: true, name: true },
      })
    : []
  const userMap = new Map(users.map(u => [u.id, u]))

  return {
    id:          s.id,
    title:       s.title,
    description: s.description,
    date:        s.date,
    location:    s.location,
    maxCapacity: s.maxCapacity,
    inscribed:   s.attendances.length,
    isActive:    s.isActive,
    attendees:   s.attendances.map(a => {
      const user = userMap.get(a.userId)
      return {
        userId:   a.userId,
        email:    user?.email ?? '',
        name:     user?.name ?? null,
        attended: a.attended,
      }
    }),
  }
}

/** Crea una sesión de capacitación */
export async function createSession(formData: FormData): Promise<
  { success: true; id: string } | { success: false; error: string }
> {
  try {
    const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'FORMACION_SESIONES', 'edit')

    const title       = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const dateStr     = formData.get('date') as string
    const location    = (formData.get('location') as string) || null
    const maxCapStr   = formData.get('maxCapacity') as string

    if (!title || !dateStr) {
      return { success: false, error: 'Título y fecha son obligatorios.' }
    }

    const session = await db.trainingSession.create({
      data: {
        tenantId,
        title,
        description,
        date:        new Date(dateStr),
        location,
        maxCapacity: maxCapStr ? parseInt(maxCapStr, 10) : null,
      },
    })

    revalidatePath('/formacion/sesiones')
    return { success: true, id: session.id }
  } catch (err) {
    console.error('[createSession]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al crear la sesión.' }
  }
}

/** Inscribir al usuario actual en una sesión */
export async function enrollInSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { db, tenantId, userId } = await getDbAndSession()

    // Verificar capacidad
    const sess = await db.trainingSession.findUnique({
      where:   { id: sessionId },
      include: { attendances: { select: { id: true } } },
    })

    if (!sess || sess.tenantId !== tenantId) {
      return { success: false, error: 'Sesión no encontrada.' }
    }

    if (sess.maxCapacity && sess.attendances.length >= sess.maxCapacity) {
      return { success: false, error: 'La sesión está llena.' }
    }

    await db.trainingAttendance.upsert({
      where:  { sessionId_userId: { sessionId, userId } },
      update: {},
      create: { tenantId, sessionId, userId },
    })

    revalidatePath(`/formacion/sesiones/${sessionId}`)
    return { success: true }
  } catch (err) {
    console.error('[enrollInSession]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al inscribirse.' }
  }
}

/** Confirmar asistencia de un usuario (solo admin) */
export async function confirmAttendance(sessionId: string, userId: string): Promise<void> {
  const { db } = await getDbAndSession(['ADMIN_CAMPANA'], 'FORMACION_SESIONES', 'edit')

  await db.trainingAttendance.updateMany({
    where: { sessionId, userId },
    data:  { attended: true },
  })

  revalidatePath(`/formacion/sesiones/${sessionId}`)
}

/** Eliminar sesión (solo admin) */
export async function deleteSession(sessionId: string): Promise<void> {
  const { db } = await getDbAndSession(['ADMIN_CAMPANA'], 'FORMACION_SESIONES', 'edit')
  // Eliminar asistencias primero, luego la sesión
  await db.trainingAttendance.deleteMany({ where: { sessionId } })
  await db.trainingSession.delete({ where: { id: sessionId } })
  revalidatePath('/formacion/sesiones')
}

// ── EVALUACIONES / QUIZZES ───────────────────────────────────────────────────

/** Lista quizzes con el mejor puntaje del usuario actual */
export async function listQuizzes(): Promise<QuizSummary[]> {
  const { db, tenantId, userId } = await getDbAndSession()

  const quizzes = await db.quiz.findMany({
    where:   { tenantId, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      questions: { select: { id: true } },
      attempts:  { where: { userId }, select: { score: true, passed: true } },
    },
  })

  return quizzes.map(q => {
    const scores = q.attempts.map(a => a.score)
    return {
      id:            q.id,
      title:         q.title,
      description:   q.description,
      passingScore:  q.passingScore,
      questionCount: q.questions.length,
      isActive:      q.isActive,
      bestScore:     scores.length > 0 ? Math.max(...scores) : null,
      passed:        q.attempts.some(a => a.passed),
    }
  })
}

/**
 * Obtiene un quiz para responder — SIN correctIndex.
 * Las preguntas se ordenan por `order`.
 */
export async function getQuizForUser(quizId: string): Promise<QuizForUser | null> {
  const { db, tenantId } = await getDbAndSession()

  const quiz = await db.quiz.findUnique({
    where:   { id: quizId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        select:  { id: true, text: true, options: true },
        // correctIndex EXCLUIDO explícitamente
      },
    },
  })

  if (!quiz || quiz.tenantId !== tenantId || !quiz.isActive) return null

  return {
    id:           quiz.id,
    title:        quiz.title,
    description:  quiz.description,
    passingScore: quiz.passingScore,
    questions:    quiz.questions.map(q => ({
      id:      q.id,
      text:    q.text,
      options: q.options as string[],
    })),
  }
}

/**
 * Envía las respuestas de un quiz. El scoring se hace server-side.
 * correctIndex NUNCA sale del servidor.
 */
export async function submitQuizAttempt(
  quizId: string,
  answers: number[],
): Promise<QuizAttemptResult> {
  const { db, tenantId, userId } = await getDbAndSession()

  // Cargar preguntas CON correctIndex (server-side only)
  const quiz = await db.quiz.findUnique({
    where:   { id: quizId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        select:  { id: true, correctIndex: true },
      },
    },
  })

  if (!quiz || quiz.tenantId !== tenantId) {
    throw new Error('Quiz no encontrado.')
  }

  const total   = quiz.questions.length
  let correct   = 0

  quiz.questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) correct++
  })

  const score  = total > 0 ? Math.round((correct / total) * 100) : 0
  const passed = score >= quiz.passingScore

  await db.quizAttempt.create({
    data: { tenantId, quizId, userId, answers, score, passed },
  })

  revalidatePath('/formacion/evaluaciones')
  revalidatePath(`/formacion/evaluaciones/${quizId}`)

  return { score, passed, total, correct }
}

/** Crea un quiz con sus preguntas (solo admin) */
export async function createQuiz(data: {
  title:        string
  description?: string
  passingScore: number
  questions:    { text: string; options: string[]; correctIndex: number }[]
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'FORMACION_EVALUACIONES', 'edit')

    if (!data.title || data.questions.length === 0) {
      return { success: false, error: 'Título y al menos una pregunta son obligatorios.' }
    }

    const quiz = await db.quiz.create({
      data: {
        tenantId,
        title:        data.title,
        description:  data.description ?? null,
        passingScore: data.passingScore,
        questions: {
          create: data.questions.map((q, i) => ({
            text:         q.text,
            options:      q.options,
            correctIndex: q.correctIndex,
            order:        i,
          })),
        },
      },
    })

    revalidatePath('/formacion/evaluaciones')
    return { success: true, id: quiz.id }
  } catch (err) {
    console.error('[createQuiz]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al crear la evaluación.' }
  }
}

/** Elimina un quiz y todas sus preguntas/intentos (solo admin) */
export async function deleteQuiz(quizId: string): Promise<void> {
  const { db } = await getDbAndSession(['ADMIN_CAMPANA'], 'FORMACION_EVALUACIONES', 'edit')
  // Cascade en QuizQuestion, pero QuizAttempt no tiene onDelete
  await db.quizAttempt.deleteMany({ where: { quizId } })
  await db.certificate.deleteMany({ where: { quizId } })
  await db.quiz.delete({ where: { id: quizId } })
  revalidatePath('/formacion/evaluaciones')
}

// ── CERTIFICADOS ─────────────────────────────────────────────────────────────

/** Lista certificados del usuario actual */
export async function listMyCertificates(): Promise<CertificateView[]> {
  const { db, tenantId, userId } = await getDbAndSession()

  const certs = await db.certificate.findMany({
    where:   { tenantId, userId },
    orderBy: { issuedAt: 'desc' },
  })

  // Obtener títulos de quizzes
  const quizIds = [...new Set(certs.map(c => c.quizId))]
  const quizzes = quizIds.length > 0
    ? await db.quiz.findMany({
        where:  { id: { in: quizIds } },
        select: { id: true, title: true },
      })
    : []
  const quizMap = new Map(quizzes.map(q => [q.id, q.title]))

  return certs.map(c => ({
    id:        c.id,
    quizTitle: quizMap.get(c.quizId) ?? 'Evaluación',
    pdfUrl:    c.pdfUrl,
    issuedAt:  c.issuedAt,
  }))
}

/** Guarda un certificado (llamado después de generar el PDF) */
export async function saveCertificate(
  quizId: string,
  pdfUrl: string,
): Promise<{ success: boolean }> {
  try {
    const { db, tenantId, userId } = await getDbAndSession()

    // Verificar que el usuario aprobó este quiz
    const aprobado = await db.quizAttempt.findFirst({
      where: { tenantId, quizId, userId, passed: true },
    })
    if (!aprobado) return { success: false }

    await db.certificate.upsert({
      where:  { tenantId_userId_quizId: { tenantId, userId, quizId } },
      update: { pdfUrl },
      create: { tenantId, userId, quizId, pdfUrl },
    })

    revalidatePath('/formacion/certificados')
    return { success: true }
  } catch (err) {
    console.error('[saveCertificate]', err instanceof Error ? err.message : err)
    return { success: false }
  }
}

// ── REPORTES ─────────────────────────────────────────────────────────────────

/** Métricas generales del módulo de formación */
export async function getFormacionMetrics(): Promise<FormacionMetrics> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'FORMACION_REPORTES')

  const [
    totalMaterials,
    totalSessions,
    totalQuizzes,
    totalCertificates,
    totalWitnesses,
    attempts,
  ] = await Promise.all([
    db.trainingMaterial.count({ where: { tenantId, isActive: true } }),
    db.trainingSession.count({ where: { tenantId, isActive: true } }),
    db.quiz.count({ where: { tenantId, isActive: true } }),
    db.certificate.count({ where: { tenantId } }),
    db.user.count({ where: { tenantId, role: 'TESTIGO', isActive: true } }),
    db.quizAttempt.findMany({ where: { tenantId }, select: { passed: true } }),
  ])

  const avgPassRate = attempts.length > 0
    ? Math.round((attempts.filter(a => a.passed).length / attempts.length) * 100)
    : null

  return {
    totalMaterials,
    totalSessions,
    totalQuizzes,
    totalCertificates,
    totalWitnesses,
    avgPassRate,
  }
}

/** Progreso de testigos para el reporte */
export async function getWitnessProgress(): Promise<WitnessProgress[]> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'FORMACION_REPORTES')

  const witnesses = await db.user.findMany({
    where:   { tenantId, role: 'TESTIGO', isActive: true },
    select:  { id: true, email: true, name: true },
    orderBy: { email: 'asc' },
  })

  if (witnesses.length === 0) return []

  const userIds = witnesses.map(w => w.id)

  const [attendances, attempts, certs] = await Promise.all([
    db.trainingAttendance.findMany({
      where:  { tenantId, userId: { in: userIds }, attended: true },
      select: { userId: true },
    }),
    db.quizAttempt.findMany({
      where:  { tenantId, userId: { in: userIds } },
      select: { userId: true, score: true, passed: true },
    }),
    db.certificate.findMany({
      where:  { tenantId, userId: { in: userIds } },
      select: { userId: true },
    }),
  ])

  // Agrupar por usuario
  const attendByUser = new Map<string, number>()
  attendances.forEach(a => attendByUser.set(a.userId, (attendByUser.get(a.userId) ?? 0) + 1))

  const attemptsByUser = new Map<string, { total: number; passed: number; sumScore: number }>()
  attempts.forEach(a => {
    const cur = attemptsByUser.get(a.userId) ?? { total: 0, passed: 0, sumScore: 0 }
    cur.total++
    if (a.passed) cur.passed++
    cur.sumScore += a.score
    attemptsByUser.set(a.userId, cur)
  })

  const certsByUser = new Map<string, number>()
  certs.forEach(c => certsByUser.set(c.userId, (certsByUser.get(c.userId) ?? 0) + 1))

  return witnesses.map(w => {
    const att = attemptsByUser.get(w.id)
    return {
      userId:             w.id,
      email:              w.email,
      name:               w.name,
      sessionsAttended:   attendByUser.get(w.id) ?? 0,
      quizzesAttempted:   att?.total ?? 0,
      quizzesPassed:      att?.passed ?? 0,
      certificatesEarned: certsByUser.get(w.id) ?? 0,
      avgScore:           att ? Math.round(att.sumScore / att.total) : null,
    }
  })
}

/** Exportar progreso de testigos como CSV */
export async function exportWitnessProgressCSV(): Promise<string> {
  const rows = await getWitnessProgress()

  const header = 'Email,Nombre,Sesiones asistidas,Evaluaciones,Aprobadas,Certificados,Puntaje promedio'
  const lines = rows.map(r =>
    `"${r.email}","${r.name ?? ''}",${r.sessionsAttended},${r.quizzesAttempted},${r.quizzesPassed},${r.certificatesEarned},${r.avgScore ?? ''}`
  )

  return [header, ...lines].join('\n')
}
