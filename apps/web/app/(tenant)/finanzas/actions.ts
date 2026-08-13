'use server'

/**
 * Server Actions del módulo FINANZAS.
 * Todas las acciones verifican autenticación, rol y módulo con requireModule('FINANZAS').
 * Campos cifrados: cedulaTesorero, cuentaBancaria (FinanceConfig), donorId (Donation).
 * Montos siempre en pesos colombianos (COP).
 */

import { requireModule, requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb, Prisma, encrypt, decrypt } from '@vectra/db'
import { revalidatePath }      from 'next/cache'

// ── Helper ───────────────────────────────────────────────────────────────────

async function getDbAndSession(
  roles: Parameters<typeof requireModule>[1] = [],
  screenKey?: string,
  accion: 'view' | 'edit' = 'view',
) {
  const session  = screenKey
    ? await requireModuleOrScreen('FINANZAS', roles, screenKey, accion)
    : await requireModule('FINANZAS', roles)
  const tenantId = session.user.tenantId as string
  const userId   = session.user.userId
  const conn     = await getTenantConnection(tenantId)
  const db       = getTenantDb(conn)
  return { db, tenantId, userId, session }
}

// ── Tipos exportados ─────────────────────────────────────────────────────────

export interface FinanceConfigView {
  cargoPostulado:     string | null
  municipio:          string | null
  topeGastos:         number | null
  fechaInicioCampana: Date | null
  fechaFinCampana:    Date | null
  nombreTesorero:     string | null
  hasCedulaTesorero:  boolean // indica si existe, nunca expone el valor
  hasCuentaBancaria:  boolean
}

export interface ExpenseView {
  id:            string
  category:      string
  description:   string
  amount:        number
  date:          Date
  vendor:        string | null
  invoiceNumber: string | null
  invoiceUrl:    string | null
  paymentMethod: string | null
  status:        string
  registeredBy:  string
  notes:         string | null
  createdAt:     Date
}

export interface ExpenseListResult {
  expenses:       ExpenseView[]
  totalAmount:    number
  byCategory:     { category: string; total: number; count: number }[]
}

export interface DonationView {
  id:            string
  donorName:     string
  donorType:     string
  amount:        number
  date:          Date
  paymentMethod: string | null
  bankReference: string | null
  receiptUrl:    string | null
  isVerified:    boolean
  notes:         string | null
  createdAt:     Date
  // donorId NUNCA se incluye
}

export interface DashboardData {
  totalGastos:        number
  totalDonaciones:    number
  balance:            number
  porcentajeTope:     number | null // null si no hay tope configurado
  topeGastos:         number | null
  gastosPorCategoria: { category: string; total: number; count: number }[]
  alertas:            { tipo: string; mensaje: string }[]
  ultimos5Gastos:     ExpenseView[]
  ultimas5Donaciones: DonationView[]
}

export interface ReportView {
  id:             string
  type:           string
  period:         string
  totalExpenses:  number
  totalDonations: number
  balance:        number
  status:         string
  fileUrl:        string | null
  generatedAt:    Date | null
  presentedAt:    Date | null
  createdAt:      Date
}

// ── CONFIGURACIÓN ────────────────────────────────────────────────────────────

export async function getFinanceConfig(): Promise<FinanceConfigView | null> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA','COORDINADOR'], 'FINANZAS_CONFIGURACION')

  const config = await db.financeConfig.findUnique({ where: { tenantId } })
  if (!config) return null

  return {
    cargoPostulado:     config.cargoPostulado,
    municipio:          config.municipio,
    topeGastos:         config.topeGastos,
    fechaInicioCampana: config.fechaInicioCampana,
    fechaFinCampana:    config.fechaFinCampana,
    nombreTesorero:     config.nombreTesorero,
    hasCedulaTesorero:  !!config.cedulaTesorero,
    hasCuentaBancaria:  !!config.cuentaBancaria,
  }
}

export async function updateFinanceConfig(data: {
  cargoPostulado?:     string
  municipio?:          string
  topeGastos?:         number
  fechaInicioCampana?: string
  fechaFinCampana?:    string
  nombreTesorero?:     string
  cedulaTesorero?:     string // se cifra antes de guardar
  cuentaBancaria?:     string // se cifra antes de guardar
}) {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'FINANZAS_CONFIGURACION', 'edit')

  const payload: Record<string, unknown> = {
    cargoPostulado:     data.cargoPostulado ?? null,
    municipio:          data.municipio ?? null,
    topeGastos:         data.topeGastos ?? null,
    fechaInicioCampana: data.fechaInicioCampana ? new Date(data.fechaInicioCampana) : null,
    fechaFinCampana:    data.fechaFinCampana ? new Date(data.fechaFinCampana) : null,
    nombreTesorero:     data.nombreTesorero ?? null,
  }

  // Cifrar campos sensibles solo si se proporcionan
  if (data.cedulaTesorero) {
    payload.cedulaTesorero = encrypt(data.cedulaTesorero)
  }
  if (data.cuentaBancaria) {
    payload.cuentaBancaria = encrypt(data.cuentaBancaria)
  }

  await db.financeConfig.upsert({
    where:  { tenantId },
    create: { tenantId, ...payload },
    update: payload,
  })

  revalidatePath('/finanzas')
}

// ── GASTOS ───────────────────────────────────────────────────────────────────

export async function listExpenses(filters?: {
  category?: string
  dateFrom?: string
  dateTo?:   string
  status?:   string
}): Promise<ExpenseListResult> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA','COORDINADOR'], 'FINANZAS_GASTOS')

  const where: Record<string, unknown> = { tenantId }
  if (filters?.category)  where.category = filters.category
  if (filters?.status)    where.status   = filters.status
  if (filters?.dateFrom || filters?.dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom)
    if (filters.dateTo)   dateFilter.lte = new Date(filters.dateTo)
    where.date = dateFilter
  }

  const [expenses, aggregate, byCategory] = await Promise.all([
    db.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    }),
    db.expense.aggregate({
      where: { tenantId },
      _sum: { amount: true },
    }),
    db.expense.groupBy({
      by:    ['category'],
      where: { tenantId },
      _sum:  { amount: true },
      _count: true,
    }),
  ])

  return {
    expenses: expenses.map(e => ({
      id:            e.id,
      category:      e.category,
      description:   e.description,
      amount:        e.amount,
      date:          e.date,
      vendor:        e.vendor,
      invoiceNumber: e.invoiceNumber,
      invoiceUrl:    e.invoiceUrl,
      paymentMethod: e.paymentMethod,
      status:        e.status,
      registeredBy:  e.registeredBy,
      notes:         e.notes,
      createdAt:     e.createdAt,
    })),
    totalAmount: aggregate._sum.amount ?? 0,
    byCategory: byCategory.map(g => ({
      category: g.category,
      total:    g._sum.amount ?? 0,
      count:    g._count,
    })),
  }
}

interface CreateExpenseInput {
  category:      string
  description:   string
  amount:        number
  date:          string
  vendor?:       string
  invoiceNumber?: string
  invoiceUrl?:   string
  paymentMethod?: string
  notes?:        string
}

export async function createExpense(data: CreateExpenseInput): Promise<{
  success: boolean
  expenseId: string
  porcentajeUsado: number | null
  advertencia?: string
}> {
  const { db, tenantId, userId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'FINANZAS_GASTOS', 'edit')

  // a) Obtener total actual de gastos ANTES de insertar
  const [aggregate, config] = await Promise.all([
    db.expense.aggregate({
      where: { tenantId },
      _sum:  { amount: true },
    }),
    db.financeConfig.findUnique({ where: { tenantId } }),
  ])

  const totalActual = aggregate._sum.amount ?? 0

  // b) Calcular nuevo total y porcentaje
  const nuevoTotal = totalActual + data.amount
  const topeGastos = config?.topeGastos ?? null
  const porcentaje = topeGastos ? (nuevoTotal / topeGastos) * 100 : null

  // c) Insertar el gasto
  const expense = await db.expense.create({
    data: {
      tenantId,
      category:      data.category,
      description:   data.description,
      amount:        data.amount,
      date:          new Date(data.date),
      vendor:        data.vendor ?? null,
      invoiceNumber: data.invoiceNumber ?? null,
      invoiceUrl:    data.invoiceUrl ?? null,
      paymentMethod: data.paymentMethod ?? null,
      registeredBy:  userId,
      notes:         data.notes ?? null,
    },
  })

  // d) Crear notificaciones de alerta si corresponde
  let advertencia: string | undefined
  if (porcentaje !== null && topeGastos) {
    if (porcentaje > 100) {
      advertencia = `TOPE SUPERADO: se ha gastado el ${porcentaje.toFixed(1)}% del tope legal ($${nuevoTotal.toLocaleString('es-CO')} de $${topeGastos.toLocaleString('es-CO')})`
      await db.notification.create({
        data: {
          tenantId,
          userId,
          type:    'TOPE_SUPERADO',
          message: advertencia,
          metadata: { porcentaje, nuevoTotal, topeGastos } as unknown as Prisma.InputJsonValue,
        },
      })
    } else if (porcentaje > 80) {
      advertencia = `ALERTA: se ha usado el ${porcentaje.toFixed(1)}% del tope legal ($${nuevoTotal.toLocaleString('es-CO')} de $${topeGastos.toLocaleString('es-CO')})`
      await db.notification.create({
        data: {
          tenantId,
          userId,
          type:    'ALERTA_TOPE_GASTOS',
          message: advertencia,
          metadata: { porcentaje, nuevoTotal, topeGastos } as unknown as Prisma.InputJsonValue,
        },
      })
    }
  }

  revalidatePath('/finanzas')

  return {
    success: true,
    expenseId: expense.id,
    porcentajeUsado: porcentaje,
    advertencia,
  }
}

export async function updateExpenseStatus(id: string, status: 'VERIFICADO' | 'OBSERVADO') {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'FINANZAS_GASTOS', 'edit')

  await db.expense.updateMany({
    where: { id, tenantId },
    data:  { status },
  })

  revalidatePath('/finanzas/gastos')
}

export async function deleteExpense(id: string) {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'FINANZAS_GASTOS', 'edit')

  // Solo se puede eliminar si está en estado REGISTRADO
  const expense = await db.expense.findFirst({
    where: { id, tenantId },
  })

  if (!expense) throw new Error('Gasto no encontrado')
  if (expense.status !== 'REGISTRADO') {
    throw new Error('Solo se pueden eliminar gastos en estado REGISTRADO')
  }

  await db.expense.delete({ where: { id } })
  revalidatePath('/finanzas/gastos')
}

// ── DONACIONES ───────────────────────────────────────────────────────────────

export async function listDonations(filters?: {
  dateFrom?:   string
  dateTo?:     string
  donorType?:  string
  isVerified?: boolean
}): Promise<DonationView[]> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA','COORDINADOR'], 'FINANZAS_DONACIONES')

  const where: Record<string, unknown> = { tenantId }
  if (filters?.donorType)            where.donorType  = filters.donorType
  if (filters?.isVerified !== undefined) where.isVerified = filters.isVerified
  if (filters?.dateFrom || filters?.dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom)
    if (filters.dateTo)   dateFilter.lte = new Date(filters.dateTo)
    where.date = dateFilter
  }

  const donations = await db.donation.findMany({
    where,
    orderBy: { date: 'desc' },
  })

  // donorId NUNCA se retorna
  return donations.map(d => ({
    id:            d.id,
    donorName:     d.donorName,
    donorType:     d.donorType,
    amount:        d.amount,
    date:          d.date,
    paymentMethod: d.paymentMethod,
    bankReference: d.bankReference,
    receiptUrl:    d.receiptUrl,
    isVerified:    d.isVerified,
    notes:         d.notes,
    createdAt:     d.createdAt,
  }))
}

interface CreateDonationInput {
  donorName:     string
  donorId?:      string  // cédula o NIT — se cifra
  donorType:     string
  amount:        number
  date:          string
  paymentMethod?: string
  bankReference?: string
  receiptUrl?:   string
  notes?:        string
}

export async function createDonation(data: CreateDonationInput): Promise<{
  success: boolean
  donationId: string
  advertencia?: string
}> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'FINANZAS_DONACIONES', 'edit')

  // Verificar si la donación individual supera el 10% del tope total
  const config = await db.financeConfig.findUnique({ where: { tenantId } })
  let advertencia: string | undefined

  if (config?.topeGastos && data.donorType === 'PERSONA_NATURAL') {
    const topeDonacionIndividual = config.topeGastos * 0.1
    if (data.amount > topeDonacionIndividual) {
      advertencia = `Esta donación ($${data.amount.toLocaleString('es-CO')}) supera el 10% del tope legal ($${topeDonacionIndividual.toLocaleString('es-CO')}). Se registra con observación.`
    }
  }

  const donation = await db.donation.create({
    data: {
      tenantId,
      donorName:     data.donorName,
      donorId:       data.donorId ? encrypt(data.donorId) : null,
      donorType:     data.donorType,
      amount:        data.amount,
      date:          new Date(data.date),
      paymentMethod: data.paymentMethod ?? null,
      bankReference: data.bankReference ?? null,
      receiptUrl:    data.receiptUrl ?? null,
      notes:         advertencia
        ? `${data.notes ?? ''} [OBSERVACIÓN: ${advertencia}]`.trim()
        : (data.notes ?? null),
    },
  })

  revalidatePath('/finanzas')

  return {
    success: true,
    donationId: donation.id,
    advertencia,
  }
}

export async function verifyDonation(id: string) {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'FINANZAS_DONACIONES', 'edit')

  await db.donation.updateMany({
    where: { id, tenantId },
    data:  { isVerified: true },
  })

  revalidatePath('/finanzas/donaciones')
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────

export async function getFinanceDashboard(): Promise<DashboardData> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA','COORDINADOR'], 'FINANZAS_DASHBOARD')

  const [
    expenseAgg,
    donationAgg,
    byCategory,
    config,
    ultimos5Gastos,
    ultimas5Donaciones,
  ] = await Promise.all([
    db.expense.aggregate({
      where: { tenantId },
      _sum:  { amount: true },
    }),
    db.donation.aggregate({
      where: { tenantId },
      _sum:  { amount: true },
    }),
    db.expense.groupBy({
      by:    ['category'],
      where: { tenantId },
      _sum:  { amount: true },
      _count: true,
    }),
    db.financeConfig.findUnique({ where: { tenantId } }),
    db.expense.findMany({
      where:   { tenantId },
      orderBy: { date: 'desc' },
      take:    5,
    }),
    db.donation.findMany({
      where:   { tenantId },
      orderBy: { date: 'desc' },
      take:    5,
    }),
  ])

  const totalGastos     = expenseAgg._sum.amount ?? 0
  const totalDonaciones = donationAgg._sum.amount ?? 0
  const balance         = totalDonaciones - totalGastos
  const topeGastos      = config?.topeGastos ?? null
  const porcentajeTope  = topeGastos ? (totalGastos / topeGastos) * 100 : null

  // Alertas
  const alertas: { tipo: string; mensaje: string }[] = []
  if (porcentajeTope !== null && topeGastos) {
    if (porcentajeTope > 100) {
      alertas.push({
        tipo:    'TOPE_SUPERADO',
        mensaje: `Se ha superado el tope legal: $${totalGastos.toLocaleString('es-CO')} de $${topeGastos.toLocaleString('es-CO')} (${porcentajeTope.toFixed(1)}%)`,
      })
    } else if (porcentajeTope > 80) {
      alertas.push({
        tipo:    'ALERTA_TOPE',
        mensaje: `Se ha usado el ${porcentajeTope.toFixed(1)}% del tope legal: $${totalGastos.toLocaleString('es-CO')} de $${topeGastos.toLocaleString('es-CO')}`,
      })
    }
  }
  if (balance < 0) {
    alertas.push({
      tipo:    'DEFICIT',
      mensaje: `Los gastos superan las donaciones por $${Math.abs(balance).toLocaleString('es-CO')}`,
    })
  }

  return {
    totalGastos,
    totalDonaciones,
    balance,
    porcentajeTope,
    topeGastos,
    gastosPorCategoria: byCategory.map(g => ({
      category: g.category,
      total:    g._sum.amount ?? 0,
      count:    g._count,
    })),
    alertas,
    ultimos5Gastos: ultimos5Gastos.map(e => ({
      id:            e.id,
      category:      e.category,
      description:   e.description,
      amount:        e.amount,
      date:          e.date,
      vendor:        e.vendor,
      invoiceNumber: e.invoiceNumber,
      invoiceUrl:    e.invoiceUrl,
      paymentMethod: e.paymentMethod,
      status:        e.status,
      registeredBy:  e.registeredBy,
      notes:         e.notes,
      createdAt:     e.createdAt,
    })),
    ultimas5Donaciones: ultimas5Donaciones.map(d => ({
      id:            d.id,
      donorName:     d.donorName,
      donorType:     d.donorType,
      amount:        d.amount,
      date:          d.date,
      paymentMethod: d.paymentMethod,
      bankReference: d.bankReference,
      receiptUrl:    d.receiptUrl,
      isVerified:    d.isVerified,
      notes:         d.notes,
      createdAt:     d.createdAt,
    })),
  }
}

// ── INFORMES ─────────────────────────────────────────────────────────────────

export async function listReports(): Promise<ReportView[]> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA','COORDINADOR'], 'FINANZAS_INFORMES')

  const reports = await db.financeReport.findMany({
    where:   { tenantId },
    orderBy: { createdAt: 'desc' },
  })

  return reports.map(r => ({
    id:             r.id,
    type:           r.type,
    period:         r.period,
    totalExpenses:  r.totalExpenses,
    totalDonations: r.totalDonations,
    balance:        r.balance,
    status:         r.status,
    fileUrl:        r.fileUrl,
    generatedAt:    r.generatedAt,
    presentedAt:    r.presentedAt,
    createdAt:      r.createdAt,
  }))
}

/**
 * Recopila datos financieros para generar el informe.
 * La generación del PDF se hace en la API route /api/finanzas/generar-informe.
 */
export async function getReportData(type: 'PARCIAL' | 'FINAL' | 'CNE') {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'FINANZAS_INFORMES')

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

  // Descifrar cédula del tesorero para el PDF
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

  return {
    tenantId,
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
    balance:             totalDonations - totalExpenses,
    porcentajeTope:      config?.topeGastos ? (totalExpenses / config.topeGastos) * 100 : null,
    gastosPorCategoria,
    donacionesPorTipo,
    totalGastos:         expenses.length,
    totalDonacionesCount: donations.length,
  }
}

export async function saveReport(data: {
  type:           string
  period:         string
  totalExpenses:  number
  totalDonations: number
  balance:        number
  fileUrl:        string
}) {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'FINANZAS_INFORMES', 'edit')

  const report = await db.financeReport.create({
    data: {
      tenantId,
      type:           data.type,
      period:         data.period,
      totalExpenses:  data.totalExpenses,
      totalDonations: data.totalDonations,
      balance:        data.balance,
      status:         'GENERADO',
      fileUrl:        data.fileUrl,
      generatedAt:    new Date(),
    },
  })

  revalidatePath('/finanzas/informes')
  return report.id
}

// ── EXPORT CSV ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  PUBLICIDAD:  'Publicidad',
  TRANSPORTE:  'Transporte',
  LOGISTICA:   'Logística',
  PERSONAL:    'Personal',
  TECNOLOGIA:  'Tecnología',
  EVENTOS:     'Eventos',
  JURIDICO:    'Jurídico',
  OTRO:        'Otro',
}

export async function exportExpensesCsv(): Promise<string> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA','COORDINADOR'], 'FINANZAS_GASTOS')

  const expenses = await db.expense.findMany({
    where:   { tenantId },
    orderBy: { date: 'desc' },
  })

  const header = 'Fecha,Categoría,Descripción,Monto,Proveedor,N° Factura,Método de pago,Estado,Notas'
  const rows = expenses.map(e => [
    e.date.toISOString().split('T')[0],
    CATEGORY_LABELS[e.category] ?? e.category,
    `"${e.description.replace(/"/g, '""')}"`,
    e.amount,
    e.vendor ? `"${e.vendor.replace(/"/g, '""')}"` : '',
    e.invoiceNumber ?? '',
    e.paymentMethod ?? '',
    e.status,
    e.notes ? `"${e.notes.replace(/"/g, '""')}"` : '',
  ].join(','))

  return [header, ...rows].join('\n')
}

export async function exportDonationsCsv(): Promise<string> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA','COORDINADOR'], 'FINANZAS_DONACIONES')

  const donations = await db.donation.findMany({
    where:   { tenantId },
    orderBy: { date: 'desc' },
  })

  const DONOR_TYPE_LABELS: Record<string, string> = {
    PERSONA_NATURAL:  'Persona natural',
    PERSONA_JURIDICA: 'Persona jurídica',
    APORTE_PROPIO:    'Aporte propio',
  }

  const header = 'Fecha,Donante,Tipo,Monto,Método de pago,Referencia bancaria,Verificado,Notas'
  const rows = donations.map(d => [
    d.date.toISOString().split('T')[0],
    `"${d.donorName.replace(/"/g, '""')}"`,
    DONOR_TYPE_LABELS[d.donorType] ?? d.donorType,
    d.amount,
    d.paymentMethod ?? '',
    d.bankReference ?? '',
    d.isVerified ? 'Sí' : 'No',
    d.notes ? `"${d.notes.replace(/"/g, '""')}"` : '',
  ].join(','))

  return [header, ...rows].join('\n')
}
