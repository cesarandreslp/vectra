import { NextRequest, NextResponse } from 'next/server'
import { requireAuth }        from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb }        from '@vectra/db'
import { put }                from '@vercel/blob'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

/**
 * POST /api/core/upload-logo
 * Sube el logo de la campaña a Vercel Blob y guarda la URL en TenantConfig.
 * Body: FormData con campo "file". Solo ADMIN_CAMPANA.
 */
export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireAuth(['ADMIN_CAMPANA'])
  } catch {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
  }

  try {
    const tenantId = session.user.tenantId
    const file     = (await req.formData()).get('file') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Archivo requerido.' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Solo PNG, JPG, SVG o WEBP.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El logo supera el máximo de 2MB.' }, { status: 400 })
    }

    const ext  = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1]
    const blob = await put(`branding/${tenantId}/logo-${Date.now()}.${ext}`, file, { access: 'public' })

    const db = getTenantDb(await getTenantConnection(tenantId))
    await db.tenantConfig.upsert({
      where:  { tenantId },
      update: { logoUrl: blob.url },
      create: { tenantId, logoUrl: blob.url },
    })

    return NextResponse.json({ success: true, url: blob.url })
  } catch (err) {
    console.error('[POST /api/core/upload-logo]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error al subir el logo.' }, { status: 500 })
  }
}
