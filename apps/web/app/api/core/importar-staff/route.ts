import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@vectra/auth'
import { getTenantConnection }        from '@/lib/tenant'
import { getTenantDb }               from '@vectra/db'
import { parsearPreviewExcel }       from '@/app/(tenant)/core/importar/_lib/excel'
import { procesarImportStaff }       from '@/app/(tenant)/core/usuarios/_lib/excel-staff'

/** POST /api/core/importar-staff — carga masiva de coordinadores y líderes. */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN_CAMPANA') return NextResponse.json({ error: 'Solo ADMIN_CAMPANA' }, { status: 403 })
  if (!session.user.activeModules.includes('CORE')) return NextResponse.json({ error: 'Módulo CORE no activo' }, { status: 403 })

  let buffer: Buffer
  try {
    const formData = await request.formData()
    const archivo  = formData.get('file') as File | null
    if (!archivo) return NextResponse.json({ error: 'Campo "file" requerido' }, { status: 400 })
    buffer = Buffer.from(await archivo.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'Error al leer el archivo' }, { status: 400 })
  }

  if (request.nextUrl.searchParams.get('preview') === 'true') {
    return NextResponse.json(parsearPreviewExcel(buffer))
  }

  try {
    const db = getTenantDb(await getTenantConnection(session.user.tenantId))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = await procesarImportStaff(buffer, session.user.tenantId, db as any)
    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[POST /api/core/importar-staff]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno al procesar el archivo' }, { status: 500 })
  }
}
