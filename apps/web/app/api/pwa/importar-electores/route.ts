import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@vectra/auth'
import { getTenantConnection }        from '@/lib/tenant'
import { getTenantDb }               from '@vectra/db'
import { parsearPreviewExcel, procesarImportExcel } from '@/app/(tenant)/core/importar/_lib/excel'

/**
 * POST /api/pwa/importar-electores — un elector sube a SU gente desde la PWA.
 * Se fuerza leaderId = su propio voterId: todo lo importado queda bajo él. El
 * motor de duplicados marca (sin crear) a quien ya esté bajo OTRO líder.
 * ?preview=true solo parsea.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  // Tiene que ser una persona con ficha de elector — el import queda bajo ella.
  if (!session.user.voterId) return NextResponse.json({ error: 'Tu cuenta no está enlazada a un elector.' }, { status: 403 })
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
    const resultado = await procesarImportExcel(
      buffer,
      session.user.voterId, // leaderId = el propio elector
      session.user.tenantId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db as any,
    )
    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[POST /api/pwa/importar-electores]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno al procesar el archivo' }, { status: 500 })
  }
}
