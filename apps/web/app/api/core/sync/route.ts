import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@vectra/auth'
import { getTenantConnection }        from '@/lib/tenant'
import { getTenantDb }               from '@vectra/db'

type CommitmentStatus =
  | 'SIN_CONTACTAR'
  | 'CONTACTADO'
  | 'SIMPATIZANTE'
  | 'COMPROMETIDO'
  | 'VOTO_SEGURO'

interface CambioOffline {
  type:      'UPDATE_COMMITMENT'
  offlineId: string
  timestamp: string   // ISO 8601
  payload:   {
    voterId: string
    status:  CommitmentStatus
    notes?:  string
  }
}

/**
 * POST /api/core/sync
 *
 * Endpoint de sincronización offline.
 * Acepta un array de cambios pendientes generados mientras el dispositivo
 * estaba sin conexión. Los procesa en orden por timestamp para mantener
 * consistencia causal.
 *
 * Retorna:
 *   { processed: number, conflicts: CambioOffline[] }
 *
 * Un conflicto ocurre cuando el timestamp del cambio offline es anterior
 * al lastContact ya registrado en la base de datos (otro dispositivo
 * actualizó el elector más recientemente).
 */
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (!session.user.activeModules.includes('CORE')) {
    return NextResponse.json({ error: 'Módulo CORE no activo' }, { status: 403 })
  }

  let cambios: CambioOffline[]

  try {
    const body = await request.json()
    cambios    = Array.isArray(body.cambios) ? body.cambios : []
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  if (cambios.length === 0) {
    return NextResponse.json({ processed: 0, conflicts: [] })
  }

  // Ordenar por timestamp ascendente — preservar orden causal
  const ordenados = [...cambios].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  try {
    const connectionString = await getTenantConnection(session.user.tenantId)
    const db               = getTenantDb(connectionString)

    let processed          = 0
    const conflicts: CambioOffline[] = []

    for (const cambio of ordenados) {
      if (cambio.type !== 'UPDATE_COMMITMENT') continue

      const { voterId, status, notes } = cambio.payload
      const tsCliente = new Date(cambio.timestamp)

      const elector = await db.voter.findFirst({
        where:  { id: voterId, tenantId: session.user.tenantId },
        select: { lastContact: true },
      })

      if (!elector) {
        conflicts.push(cambio)
        continue
      }

      // Detección de conflicto: el servidor tiene un cambio más reciente
      if (elector.lastContact && tsCliente < elector.lastContact) {
        conflicts.push(cambio)
        continue
      }

      await db.voter.update({
        where: { id: voterId },
        data: {
          commitmentStatus: status,
          lastContact:      tsCliente,
          ...(notes !== undefined && { notes }),
        },
      })

      processed++
    }

    return NextResponse.json({ processed, conflicts })

  } catch (err) {
    console.error('[POST /api/core/sync]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
