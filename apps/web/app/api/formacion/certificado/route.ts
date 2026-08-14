import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { requireModule } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb, superadminDb } from '@vectra/db'
import { put } from '@vercel/blob'
import { CertificatePDF } from './_certificate-pdf'

/**
 * POST /api/formacion/certificado
 * Genera el PDF del certificado, lo sube a Vercel Blob y guarda en DB.
 * Body: { quizId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session  = await requireModule('FORMACION')
    const tenantId = session.user.tenantId as string
    const userId   = session.user.userId
    const conn     = await getTenantConnection(tenantId)
    const db       = getTenantDb(conn)

    const { quizId } = await req.json()
    if (!quizId) {
      return NextResponse.json({ error: 'quizId requerido.' }, { status: 400 })
    }

    // Verificar que el usuario aprobó este quiz
    const attempt = await db.quizAttempt.findFirst({
      where: { tenantId, quizId, userId, passed: true },
      orderBy: { createdAt: 'desc' },
    })
    if (!attempt) {
      return NextResponse.json({ error: 'No has aprobado esta evaluación.' }, { status: 403 })
    }

    // Obtener datos para el certificado
    const [quiz, user] = await Promise.all([
      db.quiz.findUnique({ where: { id: quizId }, select: { title: true } }),
      superadminDb.user.findFirst({ where: { id: userId, tenantId }, select: { email: true, name: true } }),
    ])

    if (!quiz || !user) {
      return NextResponse.json({ error: 'Datos no encontrados.' }, { status: 404 })
    }

    const recipientName = user.name || user.email
    const quizTitle     = quiz.title
    const score         = attempt.score
    const date          = new Date().toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    })

    // Generar PDF
    const pdfBuffer = await renderToBuffer(
      CertificatePDF({ recipientName, quizTitle, score, date })
    )

    // Subir a Vercel Blob
    const fileName = `cert-${userId}-${quizId}-${Date.now()}.pdf`
    const blob = await put(`formacion/${tenantId}/certificados/${fileName}`, pdfBuffer, {
      access:      'public',
      contentType: 'application/pdf',
    })

    // Guardar en DB
    await db.certificate.upsert({
      where:  { tenantId_userId_quizId: { tenantId, userId, quizId } },
      update: { pdfUrl: blob.url },
      create: { tenantId, userId, quizId, pdfUrl: blob.url },
    })

    return NextResponse.json({ success: true, pdfUrl: blob.url })

  } catch (err) {
    console.error('[POST /api/formacion/certificado]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error al generar el certificado.' }, { status: 500 })
  }
}
