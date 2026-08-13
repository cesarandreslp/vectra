import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@vectra/auth'
import { getTenantConnection }        from '@/lib/tenant'
import { getTenantDb }               from '@vectra/db'

/**
 * PATCH /api/notificaciones/[id]/leer
 *
 * Marca una notificación como leída.
 * Verifica que la notificación pertenece al usuario autenticado.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params

  try {
    const connectionString = await getTenantConnection(session.user.tenantId)
    const db               = getTenantDb(connectionString)

    // Verificar que la notificación pertenece al usuario antes de marcar
    const notificacion = await db.notification.findFirst({
      where: { id, tenantId: session.user.tenantId, userId: session.user.userId },
    })

    if (!notificacion) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 })
    }

    await db.notification.update({
      where: { id },
      data:  { isRead: true },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/notificaciones/[id]/leer]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
