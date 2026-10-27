'use server'

/**
 * Cargos requeridos de la campaña: la plantilla del tipo de campaña
 * (_lib/cargos.ts) cruzada con quién ocupa cada plaza (CargoAsignacion).
 * Los líderes de zona son tantos como pida la meta en cascada.
 */

import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection }   from '@/lib/tenant'
import { getTenantDb, superadminDb } from '@vectra/db'
import { revalidatePath }        from 'next/cache'
import { calcularCascada, factoresDe } from './_lib/cascada'
import { plantillaPara, plazas, validarCargo, JURIDICO_RE, type EstadoCargo } from './_lib/cargos'

const ROLES = ['ADMIN_CAMPANA', 'COORDINADOR'] as const

export interface PlazaView {
  indice:  number
  estado:  EstadoCargo
  persona: string | null // 'v:<voterId>' o 'u:<userId>'
}

export interface CargoView {
  clave:       string
  nombre:      string
  descripcion: string
  multiple:    boolean
  plazas:      PlazaView[]
}

export interface OpcionPersona { id: string; nombre: string } // id con prefijo v:/u:

export interface CargosView {
  cargos:   CargoView[]
  sinMeta:  boolean // sin meta de votos no se sabe cuántos líderes de zona hacen falta
  equipo:   OpcionPersona[]
  electores: OpcionPersona[]
}

type Resultado = { success: true } | { success: false; error: string }

async function sesionYDb(accion: 'view' | 'edit') {
  const session  = await requireModuleOrScreen('CORE', [...ROLES], 'CORE_ESTRUCTURA', accion)
  const tenantId = session.user.tenantId
  return { session, tenantId, db: getTenantDb(await getTenantConnection(tenantId)) }
}

function lideresDe(cfg: Parameters<typeof factoresDe>[0] & { metaVotos?: number | null } | null): number {
  return cfg?.metaVotos ? calcularCascada(cfg.metaVotos, factoresDe(cfg)).lideres : 0
}

export async function getCargos(): Promise<CargosView> {
  const { session, tenantId, db } = await sesionYDb('view')

  const [cfg, filas, voters, usuarios, financeCfg] = await Promise.all([
    db.tenantConfig.findUnique({ where: { tenantId } }),
    db.cargoAsignacion.findMany({ where: { tenantId } }),
    db.voter.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    superadminDb.user.findMany({
      where:   { tenantId },
      select:  { id: true, name: true, email: true, customRole: { select: { name: true } } },
      orderBy: { email: 'asc' },
    }),
    session.user.activeModules.includes('FINANZAS')
      ? db.financeConfig.findUnique({ where: { tenantId }, select: { tesoreroId: true } })
      : Promise.resolve(null),
  ])

  // Sin asignación guardada, lo que ya existía antes de la plantilla: el
  // tesorero de Finanzas y el staff con rol personalizado de jurídico.
  const jur = usuarios.find((u) => u.customRole?.name && JURIDICO_RE.test(u.customRole.name))
  const previo: Record<string, string | undefined> = {
    TESORERO: financeCfg?.tesoreroId ? `v:${financeCfg.tesoreroId}` : undefined,
    JURIDICO: jur ? `u:${jur.id}` : undefined,
  }

  const lideres  = lideresDe(cfg)
  const porPlaza = new Map(filas.map((f) => [`${f.cargo}:${f.indice}`, f]))

  const cargos = plantillaPara(cfg?.electionOffice).map((c) => {
    // Si la meta bajó, las plazas sobrantes que aún tienen a alguien se siguen mostrando.
    const ocupadas = filas.filter((f) => f.cargo === c.clave && f.estado !== 'VACANTE').map((f) => f.indice + 1)
    const n = Math.max(plazas(c, lideres), ...ocupadas)
    return {
      clave: c.clave, nombre: c.nombre, descripcion: c.descripcion, multiple: Boolean(c.multiple),
      plazas: Array.from({ length: n }, (_, indice): PlazaView => {
        const f = porPlaza.get(`${c.clave}:${indice}`)
        if (f) return { indice, estado: f.estado, persona: f.voterId ? `v:${f.voterId}` : f.userId ? `u:${f.userId}` : null }
        const p = previo[c.clave]
        return p ? { indice, estado: 'ASIGNADO', persona: p } : { indice, estado: 'VACANTE', persona: null }
      }),
    }
  })

  return {
    cargos,
    sinMeta:   !cfg?.metaVotos,
    equipo:    usuarios.map((u) => ({ id: `u:${u.id}`, nombre: u.name ? `${u.name} · ${u.email}` : u.email })),
    electores: voters.map((v) => ({ id: `v:${v.id}`, nombre: v.name })),
  }
}

export async function guardarCargo(
  clave: string, indice: number, estado: EstadoCargo, persona: string | null,
): Promise<Resultado> {
  const { tenantId, db } = await sesionYDb('edit')

  const voterId = persona?.startsWith('v:') ? persona.slice(2) : null
  const userId  = persona?.startsWith('u:') ? persona.slice(2) : null
  const error   = validarCargo(estado, voterId, userId)
  if (error) return { success: false, error }

  const cfg   = await db.tenantConfig.findUnique({ where: { tenantId } })
  const cargo = plantillaPara(cfg?.electionOffice).find((c) => c.clave === clave)
  if (!cargo || !Number.isInteger(indice) || indice < 0) return { success: false, error: 'Ese cargo no está en la plantilla.' }

  const where = { tenantId_cargo_indice: { tenantId, cargo: clave, indice } }
  if (indice >= plazas(cargo, lideresDe(cfg)) && !(await db.cargoAsignacion.findUnique({ where }))) {
    return { success: false, error: 'Esa plaza no existe para la meta actual.' }
  }
  if (voterId && !(await db.voter.findFirst({ where: { id: voterId, tenantId }, select: { id: true } }))) {
    return { success: false, error: 'Ese elector no existe en esta campaña.' }
  }
  if (userId && !(await superadminDb.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } }))) {
    return { success: false, error: 'Ese usuario no es de esta campaña.' }
  }

  // Vacante también se guarda: así no reaparece el valor previo (Finanzas, rol jurídico).
  const data = { estado, voterId, userId }
  await db.cargoAsignacion.upsert({ where, update: data, create: { tenantId, cargo: clave, indice, ...data } })

  revalidatePath('/core/estructura')
  return { success: true }
}
