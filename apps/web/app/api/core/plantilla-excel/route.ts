import { NextResponse }         from 'next/server'
import { auth }                 from '@vectra/auth'
import { generarPlantillaExcel } from '@/app/(tenant)/core/importar/_lib/excel'

/**
 * GET /api/core/plantilla-excel
 *
 * Descarga la plantilla Excel con las columnas esperadas para la importación.
 * Requiere sesión autenticada con módulo CORE activo.
 */
export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (!session.user.activeModules.includes('CORE')) {
    return NextResponse.json({ error: 'Módulo CORE no activo' }, { status: 403 })
  }

  const buffer = generarPlantillaExcel()

  return new NextResponse(new Uint8Array(buffer), {
    status:  200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-electores.xlsx"',
      'Content-Length':      String(buffer.length),
    },
  })
}
