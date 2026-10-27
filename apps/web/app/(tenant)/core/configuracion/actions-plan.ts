'use server'

/**
 * Server Actions del plan de la estructura: meta de votos y factores de la
 * cascada (TenantConfig). Se ven en /core/estructura; aquí solo se editan.
 */

import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection }   from '@/lib/tenant'
import { getTenantDb }           from '@vectra/db'
import { revalidatePath }        from 'next/cache'

const ROLES = ['ADMIN_CAMPANA', 'COORDINADOR'] as const

export interface FactoresPlan {
  metaVotos:                   number | null
  tasaFuga:                    number
  tasaConversion:              number
  compromisosPorMultiplicador: number
  multiplicadoresPorLider:     number
  nivelLider:                  number
}

type Resultado = { success: true } | { success: false; error: string }

async function sesionYDb(accion: 'view' | 'edit') {
  const session  = await requireModuleOrScreen('CORE', [...ROLES], 'CORE_ESTRUCTURA', accion)
  const tenantId = session.user.tenantId
  return { tenantId, db: getTenantDb(await getTenantConnection(tenantId)) }
}

export async function getFactoresPlan(): Promise<FactoresPlan> {
  const { tenantId, db } = await sesionYDb('view')
  const cfg = await db.tenantConfig.findUnique({ where: { tenantId } })
  return {
    metaVotos:                   cfg?.metaVotos ?? null,
    tasaFuga:                    cfg?.tasaFuga ?? 0.2,
    tasaConversion:              cfg?.tasaConversion ?? 0.4,
    compromisosPorMultiplicador: cfg?.compromisosPorMultiplicador ?? 12,
    multiplicadoresPorLider:     cfg?.multiplicadoresPorLider ?? 10,
    nivelLider:                  cfg?.nivelLider ?? 1,
  }
}

export async function guardarFactoresPlan(input: FactoresPlan): Promise<Resultado> {
  const { tenantId, db } = await sesionYDb('edit')

  const entero = (n: number, min: number) => Number.isInteger(n) && n >= min
  if (input.metaVotos !== null && !entero(input.metaVotos, 1)) return { success: false, error: 'La meta de votos debe ser un entero mayor que 0.' }
  if (!(input.tasaFuga >= 0 && input.tasaFuga < 1)) return { success: false, error: 'La tasa de fuga va entre 0 % y 99 %.' }
  if (!(input.tasaConversion > 0 && input.tasaConversion <= 1)) return { success: false, error: 'La tasa de conversión va entre 1 % y 100 %.' }
  if (!entero(input.compromisosPorMultiplicador, 1) || !entero(input.multiplicadoresPorLider, 1)) {
    return { success: false, error: 'Compromisos por multiplicador y multiplicadores por líder deben ser enteros ≥ 1.' }
  }
  if (!entero(input.nivelLider, 0)) return { success: false, error: 'El nivel del líder debe ser un entero ≥ 0.' }

  const data = {
    metaVotos:                   input.metaVotos,
    tasaFuga:                    input.tasaFuga,
    tasaConversion:              input.tasaConversion,
    compromisosPorMultiplicador: input.compromisosPorMultiplicador,
    multiplicadoresPorLider:     input.multiplicadoresPorLider,
    nivelLider:                  input.nivelLider,
  }
  await db.tenantConfig.upsert({ where: { tenantId }, update: data, create: { tenantId, ...data } })

  // La fuga cambia el avance que muestran el mapa, los líderes y Analytics.
  revalidatePath('/', 'layout')
  return { success: true }
}

// ── Hitos con fecha ──────────────────────────────────────────────────────────

export interface HitoView {
  id:              string
  fecha:           string // YYYY-MM-DD
  contactos:       number
  compromisos:     number
  lideres:         number
  multiplicadores: number
  nota:            string | null
}

export type HitoInput = Omit<HitoView, 'id'>

function validarHito(h: HitoInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.fecha) || isNaN(Date.parse(h.fecha))) return 'Fecha inválida.'
  const nums = [h.contactos, h.compromisos, h.lideres, h.multiplicadores]
  if (!nums.every((n) => Number.isInteger(n) && n >= 0)) return 'Las cantidades deben ser enteros ≥ 0.'
  return null
}

function datosHito(h: HitoInput) {
  return {
    fecha:           new Date(`${h.fecha}T00:00:00Z`),
    contactos:       h.contactos,
    compromisos:     h.compromisos,
    lideres:         h.lideres,
    multiplicadores: h.multiplicadores,
    nota:            h.nota?.trim() || null,
  }
}

function revalidarHitos() {
  revalidatePath('/core/configuracion')
  revalidatePath('/core/estructura')
}

export async function listarHitos(): Promise<HitoView[]> {
  const { tenantId, db } = await sesionYDb('view')
  const hitos = await db.hitoEstructura.findMany({ where: { tenantId }, orderBy: { fecha: 'asc' } })
  return hitos.map((h) => ({
    id: h.id, fecha: h.fecha.toISOString().slice(0, 10), nota: h.nota,
    contactos: h.contactos, compromisos: h.compromisos, lideres: h.lideres, multiplicadores: h.multiplicadores,
  }))
}

export async function crearHito(input: HitoInput): Promise<Resultado> {
  const { tenantId, db } = await sesionYDb('edit')
  const error = validarHito(input)
  if (error) return { success: false, error }
  await db.hitoEstructura.create({ data: { tenantId, ...datosHito(input) } })
  revalidarHitos()
  return { success: true }
}

export async function actualizarHito(id: string, input: HitoInput): Promise<Resultado> {
  const { tenantId, db } = await sesionYDb('edit')
  const error = validarHito(input)
  if (error) return { success: false, error }
  const { count } = await db.hitoEstructura.updateMany({ where: { id, tenantId }, data: datosHito(input) })
  if (!count) return { success: false, error: 'El hito no existe.' }
  revalidarHitos()
  return { success: true }
}

export async function eliminarHito(id: string): Promise<Resultado> {
  const { tenantId, db } = await sesionYDb('edit')
  await db.hitoEstructura.deleteMany({ where: { id, tenantId } })
  revalidarHitos()
  return { success: true }
}
