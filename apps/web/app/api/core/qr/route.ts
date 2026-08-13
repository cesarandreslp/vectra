import { NextResponse }     from 'next/server'
import { auth }              from '@vectra/auth'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb }       from '@vectra/db'

/**
 * GET /api/core/qr
 * Retorna todos los QR del tenant + lista de líderes para el panel de gestión.
 */
export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const rolesPermitidos = ['ADMIN_CAMPANA', 'COORDINADOR']
  if (!rolesPermitidos.includes(session.user.role)) {
    return NextResponse.json({ error: 'Sin autorización' }, { status: 403 })
  }

  if (!session.user.activeModules.includes('CORE')) {
    return NextResponse.json({ error: 'Módulo CORE no activo' }, { status: 403 })
  }

  try {
    const connectionString = await getTenantConnection(session.user.tenantId)
    const db               = getTenantDb(connectionString)

    const [qrs, lideres] = await Promise.all([
      db.qrRegistration.findMany({
        where:   { tenantId: session.user.tenantId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, leaderId: true, token: true, isActive: true,
          expiresAt: true, registrationsCount: true, createdAt: true,
        },
      }),
      // Cualquier elector puede ser dueño de un QR — es el mecanismo para
      // conseguir su primer follower, no requiere tener followers ya.
      db.voter.findMany({
        where:   { tenantId: session.user.tenantId, status: 'ACTIVO' },
        select:  { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])

    // Obtener el slug del tenant desde superadminDb para construir la URL del QR
    const { superadminDb } = await import('@vectra/db')
    const tenant = await superadminDb.tenant.findUnique({
      where:  { id: session.user.tenantId },
      select: { slug: true },
    })

    return NextResponse.json({
      qrs,
      lideres,
      tenantId:   session.user.tenantId,
      tenantSlug: tenant?.slug ?? '',
    })
  } catch (err) {
    console.error('[GET /api/core/qr]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
