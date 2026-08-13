import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@vectra/auth'
import { getTenantConnection }        from '@/lib/tenant'
import { getTenantDb }               from '@vectra/db'
import { idsSubarbol }               from '@/app/(tenant)/core/actions'

type CommitmentStatus =
  | 'SIN_CONTACTAR'
  | 'CONTACTADO'
  | 'SIMPATIZANTE'
  | 'COMPROMETIDO'
  | 'VOTO_SEGURO'

const ESTADOS_VALIDOS: CommitmentStatus[] = [
  'SIN_CONTACTAR', 'CONTACTADO', 'SIMPATIZANTE', 'COMPROMETIDO', 'VOTO_SEGURO',
]

/**
 * PATCH /api/core/electores/[id]/compromiso
 *
 * Actualiza el estado de compromiso de un elector.
 * Acepta { status, notes?, offlineId?, timestamp? } para soporte offline.
 * El campo offlineId permite deduplicar si el cliente envía la misma actualización
 * dos veces (por ejemplo, al reconectar después de estar offline).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (!session.user.activeModules.includes('CORE')) {
    return NextResponse.json({ error: 'Módulo CORE no activo' }, { status: 403 })
  }

  let body: {
    status:     CommitmentStatus
    notes?:     string
    offlineId?: string
    timestamp?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  if (!ESTADOS_VALIDOS.includes(body.status)) {
    return NextResponse.json(
      { error: `Estado inválido. Válidos: ${ESTADOS_VALIDOS.join(', ')}` },
      { status: 400 },
    )
  }

  const { id } = await params

  try {
    const connectionString = await getTenantConnection(session.user.tenantId)
    const db               = getTenantDb(connectionString)

    const elector = await db.voter.findFirst({
      where: { id, tenantId: session.user.tenantId },
    })

    if (!elector) {
      return NextResponse.json({ error: 'Elector no encontrado' }, { status: 404 })
    }

    // LIDER/ELECTOR solo pueden actualizar electores de su propio sub-árbol.
    if (session.user.role === 'LIDER' || session.user.role === 'ELECTOR') {
      if (!session.user.voterId) {
        return NextResponse.json({ error: 'Tu usuario no está vinculado a un elector' }, { status: 403 })
      }
      const permitidos = await idsSubarbol(session.user.voterId, session.user.tenantId, db as any)
      if (!permitidos.has(id)) {
        return NextResponse.json({ error: 'No tienes acceso a este elector' }, { status: 403 })
      }
    }

    // Deduplicación offline: si llega un timestamp anterior al lastContact actual,
    // ignorar (el cambio ya fue procesado por otra vía)
    if (body.timestamp && elector.lastContact) {
      const tsCliente = new Date(body.timestamp)
      if (tsCliente < elector.lastContact) {
        return NextResponse.json(
          { skipped: true, reason: 'Cambio anterior al último contacto registrado' },
          { status: 200 },
        )
      }
    }

    const actualizado = await db.voter.update({
      where: { id },
      data: {
        commitmentStatus: body.status,
        lastContact:      body.timestamp ? new Date(body.timestamp) : new Date(),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      select: {
        id:               true,
        name:             true,
        commitmentStatus: true,
        lastContact:      true,
        notes:            true,
        // cedula: NUNCA
      },
    })

    return NextResponse.json({ elector: actualizado, offlineId: body.offlineId })

  } catch (err) {
    console.error('[PATCH /api/core/electores/[id]/compromiso]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
