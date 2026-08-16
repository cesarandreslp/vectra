import { NextResponse }            from 'next/server'
import { auth }                    from '@vectra/auth'
import { generarPlantillaElector } from '@/app/(tenant)/core/importar/_lib/excel'

/** GET /api/pwa/plantilla-electores — plantilla simple para que un elector suba su gente. */
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!session.user.voterId) return NextResponse.json({ error: 'Tu cuenta no está enlazada a un elector.' }, { status: 403 })

  const buffer = generarPlantillaElector()
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="mi-gente.xlsx"',
      'Content-Length':      String(buffer.length),
    },
  })
}
