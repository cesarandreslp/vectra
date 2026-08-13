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
    const [tenantCfg, config, expenses, donations, expenseAgg, donationAgg] = await Promise.all([
      db.tenantConfig.findUnique({ where: { tenantId } }),
      db.financeConfig.findUnique({ where: { tenantId }, include: { tesorero: { select: { name: true, cedula: true } } } }),
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

    // Nombre y cédula del tesorero salen de su ficha de elector (Voter). La cédula
    // está cifrada allí; se descifra solo acá para el PDF, nunca se pasa cifrada.
    let cedulaTesoreroPlain: string | null = null
    if (config?.tesorero?.cedula) {
      try {
        cedulaTesoreroPlain = decrypt(config.tesorero.cedula)
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

    // Cargo y circunscripción salen de la config de campaña (core), única
    // fuente. Antes se re-pedían en la config de finanzas (columnas muertas).
    const CARGO_LABEL: Record<string, string> = {
      ALCALDE: 'Alcalde/Alcaldesa', CONCEJAL: 'Concejal', GOBERNADOR: 'Gobernador/Gobernadora',
      DIPUTADO: 'Diputado (Asamblea Departamental)', REPRESENTANTE: 'Representante a la Cámara',
      SENADOR: 'Senador/Senadora', PRESIDENTE: 'Presidente',
    }
    const cargoPostulado = tenantCfg?.electionOffice
      ? CARGO_LABEL[tenantCfg.electionOffice] ?? tenantCfg.electionOffice
      : null
    let municipio: string | null = null
    if (tenantCfg?.electionMunicipalityDivipola) {
      const m = await db.municipality.findUnique({
        where:   { divipola: tenantCfg.electionMunicipalityDivipola },
        include: { department: true },
      })
      if (m) municipio = `${m.name}, ${m.department.name}`
    }

    const informeData: InformeData = {
      type,
      config: config ? {
        cargoPostulado,
        municipio,
        topeGastos:         config.topeGastos,
        fechaInicioCampana: config.fechaInicioCampana,
        fechaFinCampana:    config.fechaFinCampana,
        nombreTesorero:     config.tesorero?.name ?? null,
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
