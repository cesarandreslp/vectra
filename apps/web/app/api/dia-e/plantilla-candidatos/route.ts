import { NextResponse }                from 'next/server'
import { auth }                        from '@vectra/auth'
import { generarPlantillaCandidatos }  from '@/app/(tenant)/dia-e/_lib/excel-candidatos'

/** GET /api/dia-e/plantilla-candidatos — descarga la plantilla de candidatos. */
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!session.user.activeModules.includes('DIA_E')) return NextResponse.json({ error: 'Módulo DIA_E no activo' }, { status: 403 })

  const buffer = generarPlantillaCandidatos()
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-candidatos.xlsx"',
      'Content-Length':      String(buffer.length),
    },
  })
}
