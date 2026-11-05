'use server'

/**
 * Agente IA de la campaña: lo que sabe (propuestas, biografía, tono,
 * lineamientos, texto de autorización), su aprobación y a quién escala.
 * El agente solo usa la versión APROBADA: guardar no cambia lo que dice.
 */

import { revalidatePath } from 'next/cache'
import { getTenantDb, superadminDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { requireModuleOrScreen } from '@/lib/auth-helpers'

export interface TextosAgente {
  propuestas: string; biografia: string; tono: string; lineamientos: string; textoAutorizacion: string
}

export interface VistaAgente {
  textos:              TextosAgente
  activo:              boolean
  aprobadoEn:          string | null
  aprobadoPor:         string | null
  cambiosSinAprobar:   boolean
  escalamientoUserIds: string[]
  escalamientoHorario: string
  usuarios:            { id: string; nombre: string }[]
  whatsappListo:       boolean
}

type Resultado = { success: true } | { success: false; error: string }

const LIMITES: Record<keyof TextosAgente, number> = {
  propuestas: 20_000, biografia: 8_000, tono: 500, lineamientos: 8_000, textoAutorizacion: 2_000,
}
const VACIO: TextosAgente = { propuestas: '', biografia: '', tono: '', lineamientos: '', textoAutorizacion: '' }

async function sesionYDb(accion: 'view' | 'edit') {
  const session  = await requireModuleOrScreen('COMUNICACIONES', ['ADMIN_CAMPANA'], 'COMUNICACIONES_AGENTE', accion)
  const tenantId = session.user.tenantId
  return { session, tenantId, db: getTenantDb(await getTenantConnection(tenantId)) }
}

function textosDe(a: Partial<TextosAgente> | null | undefined): TextosAgente {
  return {
    propuestas: a?.propuestas ?? '', biografia: a?.biografia ?? '', tono: a?.tono ?? '',
    lineamientos: a?.lineamientos ?? '', textoAutorizacion: a?.textoAutorizacion ?? '',
  }
}

async function usuariosDelTenant(tenantId: string) {
  const us = await superadminDb.user.findMany({
    where:   { tenantId, isActive: true, role: { in: ['ADMIN_CAMPANA', 'COORDINADOR', 'PERSONALIZADO'] } },
    select:  { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
  return us.map((u) => ({ id: u.id, nombre: u.name ? `${u.name} · ${u.email}` : u.email }))
}

export async function getAgente(): Promise<VistaAgente> {
  const { tenantId, db } = await sesionYDb('view')
  const [a, config, usuarios] = await Promise.all([
    db.agenteCampana.findUnique({ where: { tenantId } }),
    db.tenantConfig.findUnique({ where: { tenantId }, select: { whatsappToken: true, whatsappPhoneId: true, whatsappAppSecret: true } }),
    usuariosDelTenant(tenantId),
  ])
  const textos = textosDe(a)
  return {
    textos,
    activo:              a?.activo ?? false,
    aprobadoEn:          a?.aprobadoEn?.toISOString() ?? null,
    aprobadoPor:         usuarios.find((u) => u.id === a?.aprobadoPorId)?.nombre ?? null,
    cambiosSinAprobar:   JSON.stringify(textos) !== JSON.stringify(textosDe(a?.versionAprobada as Partial<TextosAgente> | null)),
    escalamientoUserIds: a?.escalamientoUserIds ?? [],
    escalamientoHorario: a?.escalamientoHorario ?? '',
    usuarios,
    whatsappListo:       Boolean(config?.whatsappToken && config.whatsappPhoneId && config.whatsappAppSecret),
  }
}

export async function guardarAgente(
  textos: TextosAgente,
  escalamiento: { userIds: string[]; horario: string },
): Promise<Resultado> {
  const { tenantId, db } = await sesionYDb('edit')
  const limpio = { ...VACIO }
  for (const campo of Object.keys(LIMITES) as (keyof TextosAgente)[]) {
    const v = typeof textos?.[campo] === 'string' ? textos[campo].trim() : ''
    if (v.length > LIMITES[campo]) return { success: false, error: `"${campo}" pasa de ${LIMITES[campo]} caracteres.` }
    limpio[campo] = v
  }
  // Solo usuarios de ESTA campaña: el id llega del navegador.
  const validos = new Set((await usuariosDelTenant(tenantId)).map((u) => u.id))
  const userIds = [...new Set(escalamiento?.userIds ?? [])].filter((id) => validos.has(id))
  const horario = (escalamiento?.horario ?? '').trim().slice(0, 200) || null

  await db.agenteCampana.upsert({
    where:  { tenantId },
    create: { tenantId, ...limpio, escalamientoUserIds: userIds, escalamientoHorario: horario },
    update: { ...limpio, escalamientoUserIds: userIds, escalamientoHorario: horario },
  })
  revalidatePath('/comunicaciones/agente')
  return { success: true }
}

/** Congela lo guardado como lo que el agente puede decir. */
export async function aprobarAgente(): Promise<Resultado> {
  const { session, tenantId, db } = await sesionYDb('edit')
  const a = await db.agenteCampana.findUnique({ where: { tenantId } })
  const t = textosDe(a)
  if (!t.propuestas || !t.biografia) return { success: false, error: 'Faltan las propuestas o la biografía: sin eso el agente no tiene qué decir.' }
  if (!t.textoAutorizacion) return { success: false, error: 'Falta el texto de autorización de datos (Ley 1581): sin él el agente no puede anotar a nadie.' }

  await db.agenteCampana.update({
    where: { tenantId },
    data:  { versionAprobada: { ...t }, aprobadoEn: new Date(), aprobadoPorId: session.user.userId },
  })
  revalidatePath('/comunicaciones/agente')
  return { success: true }
}

export async function setAgenteActivo(activo: boolean): Promise<Resultado> {
  const { tenantId, db } = await sesionYDb('edit')
  const a = await db.agenteCampana.findUnique({ where: { tenantId }, select: { aprobadoEn: true } })
  if (activo && !a?.aprobadoEn) return { success: false, error: 'Primero aprueba lo que el agente puede decir.' }
  if (!a) return { success: true } // apagar algo que nunca se configuró
  await db.agenteCampana.update({ where: { tenantId }, data: { activo: activo === true } })
  revalidatePath('/comunicaciones/agente')
  return { success: true }
}
