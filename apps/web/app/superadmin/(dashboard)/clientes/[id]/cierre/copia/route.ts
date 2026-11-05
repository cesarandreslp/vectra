import { NextResponse } from 'next/server'
import { auth } from '@vectra/auth'
import { superadminDb, getTenantDb, registrarAcceso } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { padronCsv } from '@/lib/cierre-campana'

/**
 * GET: copia del padrón de una campaña (CSV), para entregarla a la campaña
 * antes de suprimir sus datos. Solo SUPERADMIN. Queda en la bitácora y marca
 * Tenant.copiaPadronEn (sin copia no se deja cerrar).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (session?.user?.role !== 'SUPERADMIN') return new NextResponse('Forbidden', { status: 403 })
  const { id } = await params
  const tenant = await superadminDb.tenant.findUnique({ where: { id }, select: { id: true, slug: true, datosSuprimidosEn: true } })
  if (!tenant) return new NextResponse('No encontrado', { status: 404 })
  if (tenant.datosSuprimidosEn) return new NextResponse('Los datos de esta campaña ya fueron suprimidos.', { status: 410 })

  const { csv, filas } = await padronCsv(getTenantDb(await getTenantConnection(id)), id)
  await superadminDb.tenant.update({ where: { id }, data: { copiaPadronEn: new Date() } })
  await registrarAcceso({
    tenantId: id, userId: session.user.userId, accion: 'EXPORTAR_PADRON', detalle: `${filas} electores (copia de cierre)`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  })

  const fecha = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="padron-${tenant.slug}-${fecha}.csv"`,
      'Cache-Control':       'no-store',
    },
  })
}
