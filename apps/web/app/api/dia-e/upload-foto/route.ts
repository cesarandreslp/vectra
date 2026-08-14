import { NextRequest, NextResponse } from 'next/server'
import { requireModule } from '@/lib/auth-helpers'
import { put } from '@vercel/blob'

/**
 * POST /api/dia-e/upload-foto
 * Sube una imagen del E-14 a Vercel Blob.
 * Solo usuarios autenticados con módulo DIA_E.
 * Body: FormData con campo "file" (imagen) y "votingTableId"
 */
/** Lo que sale de la cámara de un celular. HEIC es el formato por defecto en iPhone. */
const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/** Una foto de acta de un celular ronda 2-5 MB; 15 deja margen de sobra. */
const MAX_BYTES = 15 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const session  = await requireModule('DIA_E')
    const tenantId = session.user.tenantId as string

    const formData      = await req.formData()
    const file           = formData.get('file') as File | null
    const votingTableId  = formData.get('votingTableId') as string

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Archivo requerido.' }, { status: 400 })
    }

    if (!votingTableId) {
      return NextResponse.json({ error: 'votingTableId requerido.' }, { status: 400 })
    }

    // El accept="image/*" del formulario es solo una sugerencia del navegador:
    // sin esto, un PDF o cualquier archivo se guardaba como .jpg y se le mandaba
    // a las IAs. Se valida acá, que es el único lado que manda.
    if (!TIPOS_ACEPTADOS.includes(file.type)) {
      return NextResponse.json(
        { error: 'El acta debe ser una foto (JPG, PNG, WEBP o HEIC).' },
        { status: 400 },
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `La foto pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es ${MAX_BYTES / 1024 / 1024} MB.` },
        { status: 400 },
      )
    }

    const timestamp = Date.now()
    const blob = await put(
      `dia-e/${tenantId}/${votingTableId}/${timestamp}.jpg`,
      file,
      { access: 'public' },
    )

    return NextResponse.json({ success: true, url: blob.url })
  } catch (err) {
    console.error('[POST /api/dia-e/upload-foto]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error al subir la imagen.' }, { status: 500 })
  }
}
