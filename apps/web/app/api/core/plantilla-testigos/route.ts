import { NextResponse }              from 'next/server'
import { auth }                      from '@vectra/auth'
import { generarPlantillaTestigos }  from '@/app/(tenant)/core/usuarios/_lib/excel-testigos'

/** GET /api/core/plantilla-testigos — descarga la plantilla de testigos. */
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!session.user.activeModules.includes('DIA_E')) {
    return NextResponse.json({ error: 'Módulo DIA_E no activo' }, { status: 403 })
  }

  const buffer = generarPlantillaTestigos()
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-testigos.xlsx"',
      'Content-Length':      String(buffer.length),
    },
  })
}
