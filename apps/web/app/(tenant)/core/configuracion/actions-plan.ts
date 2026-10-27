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

  revalidatePath('/core/configuracion')
  revalidatePath('/core/estructura')
  return { success: true }
}
