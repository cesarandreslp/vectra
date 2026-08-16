import { NextResponse }           from 'next/server'
import { auth }                   from '@vectra/auth'
import { generarPlantillaStaff }  from '@/app/(tenant)/core/usuarios/_lib/excel-staff'

/** GET /api/core/plantilla-staff — plantilla de coordinadores y líderes. */
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN_CAMPANA') return NextResponse.json({ error: 'Solo ADMIN_CAMPANA' }, { status: 403 })

  const buffer = generarPlantillaStaff()
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-equipo.xlsx"',
      'Content-Length':      String(buffer.length),
    },
  })
}
