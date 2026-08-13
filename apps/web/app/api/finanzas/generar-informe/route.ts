import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { requireModule } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb, decrypt } from '@vectra/db'
import { put } from '@vercel/blob'
import { InformePDF } from './_informe-pdf'
import type { InformeData } from './_informe-pdf'

const VALID_TYPES = ['PARCIAL', 'FINAL', 'CNE']

/**
 * POST /api/finanzas/generar-informe
 * Genera un PDF de informe financiero, lo sube a Vercel Blob
 * y guarda el registro en FinanceReport.
 * Body: { type: 'PARCIAL' | 'FINAL' | 'CNE' }
 * Solo ADMIN_CAMPANA con módulo FINANZAS.
 */
export async function POST(req: NextRequest) {
  try {
    const session  = await requireModule('FINANZAS', ['ADMIN_CAMPANA'])
    const tenantId = session.user.tenantId as string
    const conn     = await getTenantConnection(tenantId)
    const db       = getTenantDb(conn)

    const { type } = await req.json()
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Tipo de informe inválido.' }, { status: 400 })
    }

    // Recopilar todos los datos financieros
    const [config, expenses, donations, expenseAgg, donationAgg] = await Promise.all([
      db.financeConfig.findUnique({ where: { tenantId } }),
      db.expense.findMany({
        where:   { tenantId },
        orderBy: { date: 'asc' },
      }),
      db.donation.findMany({
        where:   { tenantId },
        orderBy: { date: 'asc' },
      }),
      db.expense.aggregate({
        where: { tenantId },
        _sum:  { amount: true },
      }),
      db.donation.aggregate({
        where: { tenantId },
        _sum:  { amount: true },
      }),
    ])

    const totalExpenses  = expenseAgg._sum.amount ?? 0
    const totalDonations = donationAgg._sum.amount ?? 0

    // Descifrar cédula del tesorero para el PDF — nunca pasar cifrada
    let cedulaTesoreroPlain: string | null = null
    if (config?.cedulaTesorero) {
      try {
        cedulaTesoreroPlain = decrypt(config.cedulaTesorero)
      } catch {
        cedulaTesoreroPlain = '[Error al descifrar]'
      }
    }

    // Agrupar gastos por categoría
    const gastosPorCategoria: Record<string, number> = {}
    for (const e of expenses) {
      gastosPorCategoria[e.category] = (gastosPorCategoria[e.category] ?? 0) + e.amount
    }

    // Agrupar donaciones por tipo
    const donacionesPorTipo: Record<string, number> = {}
    for (const d of donations) {
      donacionesPorTipo[d.donorType] = (donacionesPorTipo[d.donorType] ?? 0) + d.amount
    }

    const informeData: InformeData = {
      type,
      config: config ? {
        cargoPostulado:     config.cargoPostulado,
        municipio:          config.municipio,
        topeGastos:         config.topeGastos,
        fechaInicioCampana: config.fechaInicioCampana,
        fechaFinCampana:    config.fechaFinCampana,
        nombreTesorero:     config.nombreTesorero,
        cedulaTesorero:     cedulaTesoreroPlain,
      } : null,
      totalExpenses,
      totalDonations,
      balance:              totalDonations - totalExpenses,
      porcentajeTope:       config?.topeGastos ? (totalExpenses / config.topeGastos) * 100 : null,
      gastosPorCategoria,
      donacionesPorTipo,
      totalGastos:          expenses.length,
      totalDonacionesCount: donations.length,
    }

    // Generar PDF
    const pdfBuffer = await renderToBuffer(InformePDF({ data: informeData }))

    // Subir a Vercel Blob
    const fecha    = new Date().toISOString().split('T')[0]
    const fileName = `${type.toLowerCase()}-${fecha}-${Date.now()}.pdf`
    const blob = await put(
      `finanzas/${tenantId}/informes/${fileName}`,
      pdfBuffer,
      { access: 'public', contentType: 'application/pdf' },
    )

    // Determinar período
    const period = type === 'FINAL'
      ? 'FINAL'
      : `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`

    // Guardar registro en DB
    const report = await db.financeReport.create({
      data: {
        tenantId,
        type,
        period,
        totalExpenses,
        totalDonations,
        balance:     totalDonations - totalExpenses,
        status:      'GENERADO',
        fileUrl:     blob.url,
        generatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success:  true,
      reportId: report.id,
      fileUrl:  blob.url,
    })

  } catch (err) {
    console.error('[POST /api/finanzas/generar-informe]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error al generar el informe.' }, { status: 500 })
  }
}
