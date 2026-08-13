import { NextRequest, NextResponse }  from 'next/server'
import { auth }                       from '@vectra/auth'
import { getTenantConnection }         from '@/lib/tenant'
import { getTenantDb }                from '@vectra/db'
import { parsearPreviewExcel, procesarImportExcel } from '@/app/(tenant)/core/importar/_lib/excel'

/**
 * POST /api/core/importar-excel
 *
 * Procesa un archivo Excel de electores.
 * El archivo se recibe como multipart/form-data con campo "file".
 *
 * Modos:
 *   ?preview=true  → retorna { headers, rows, total } sin persistir nada
 *   (sin flag)     → procesa completo, retorna { created, skipped, duplicates, errors }
 *
 * xlsx nunca llega al bundle del cliente — este endpoint corre exclusivamente en el servidor.
 */
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const rolesPermitidos = ['ADMIN_CAMPANA', 'COORDINADOR']
  if (!rolesPermitidos.includes(session.user.role)) {
    return NextResponse.json({ error: 'Solo ADMIN_CAMPANA y COORDINADOR pueden importar' }, { status: 403 })
  }

  if (!session.user.activeModules.includes('CORE')) {
    return NextResponse.json({ error: 'Módulo CORE no activo' }, { status: 403 })
  }

  // Leer el archivo del multipart
  let buffer: Buffer
  let leaderId: string
  try {
    const formData  = await request.formData()
    const archivo   = formData.get('file') as File | null
    const leaderIdF = formData.get('leaderId') as string | null

    if (!archivo) {
      return NextResponse.json({ error: 'Campo "file" requerido' }, { status: 400 })
    }
    if (!leaderIdF) {
      return NextResponse.json({ error: 'Campo "leaderId" requerido' }, { status: 400 })
    }

    const arrayBuffer = await archivo.arrayBuffer()
    buffer   = Buffer.from(arrayBuffer)
    leaderId = leaderIdF
  } catch {
    return NextResponse.json({ error: 'Error al leer el archivo' }, { status: 400 })
  }

  const esPreview = request.nextUrl.searchParams.get('preview') === 'true'

  if (esPreview) {
    // Solo parsear y retornar preview — sin tocar la DB
    const preview = parsearPreviewExcel(buffer)
    return NextResponse.json(preview)
  }

  // Importación completa
  try {
    const connectionString = await getTenantConnection(session.user.tenantId)
    const db               = getTenantDb(connectionString)

    const resultado = await procesarImportExcel(
      buffer,
      leaderId,
      session.user.tenantId,
      db as any,
    )

    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[POST /api/core/importar-excel]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno al procesar el archivo' }, { status: 500 })
  }
}
