import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@vectra/auth'
import { getTenantConnection }        from '@/lib/tenant'
import { getTenantDb }               from '@vectra/db'
import { parsearPreviewExcel }       from '@/app/(tenant)/core/importar/_lib/excel'
import { procesarImportTestigos }    from '@/app/(tenant)/core/usuarios/_lib/excel-testigos'

/**
 * POST /api/core/importar-testigos — carga masiva de testigos desde Excel.
 * multipart/form-data con campo "file". ?preview=true solo parsea (no persiste).
 * Solo ADMIN_CAMPANA (crear cuentas). xlsx corre solo en el servidor.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN_CAMPANA') {
    return NextResponse.json({ error: 'Solo ADMIN_CAMPANA puede importar testigos' }, { status: 403 })
  }
  if (!session.user.activeModules.includes('DIA_E')) {
    return NextResponse.json({ error: 'Módulo DIA_E no activo' }, { status: 403 })
  }

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
    const resultado = await procesarImportTestigos(
      buffer,
      session.user.tenantId,
      session.user.tenantSlug ?? '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db as any,
    )
    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[POST /api/core/importar-testigos]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno al procesar el archivo' }, { status: 500 })
  }
}
