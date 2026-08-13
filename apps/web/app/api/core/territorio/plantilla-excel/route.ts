import { NextResponse }               from 'next/server'
import { auth }                       from '@vectra/auth'
import { generarPlantillaTerritorioExcel } from '@/app/(tenant)/core/territorio/_lib/excel'

/**
 * GET /api/core/territorio/plantilla-excel
 * Descarga la plantilla Excel (comunas, barrios, puestos, mesas) para cargar
 * territorio masivamente en municipios sin datos DIVIPOLA a ese nivel.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (!session.user.activeModules.includes('CORE')) {
    return NextResponse.json({ error: 'Módulo CORE no activo' }, { status: 403 })
  }

  const buffer = generarPlantillaTerritorioExcel()

  return new NextResponse(new Uint8Array(buffer), {
    status:  200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-territorio.xlsx"',
      'Content-Length':      String(buffer.length),
    },
  })
}
