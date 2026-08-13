import { NextResponse }     from 'next/server'
import { auth }              from '@vectra/auth'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb }       from '@vectra/db'

/**
 * GET /api/notificaciones
 *
 * Retorna las notificaciones NO leídas del usuario autenticado.
 * Máximo 20, ordenadas por createdAt DESC.
 */
export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const connectionString = await getTenantConnection(session.user.tenantId)
    const db               = getTenantDb(connectionString)

    const notificaciones = await db.notification.findMany({
      where: {
        tenantId: session.user.tenantId,
        userId:   session.user.userId,
        isRead:   false,
      },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select: {
        id:        true,
        type:      true,
        message:   true,
        metadata:  true,
        createdAt: true,
      },
    })

    return NextResponse.json({ notificaciones, total: notificaciones.length })
  } catch (err) {
    console.error('[GET /api/notificaciones]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
