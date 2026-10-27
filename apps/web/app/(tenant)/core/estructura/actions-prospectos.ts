'use server'

/**
 * "Lista de los 100": embudo de reclutamiento de líderes. Cada prospecto pasa
 * por candidato → conversado → aceptó / no aceptó; al aceptar queda enlazado
 * al Voter que actúa como líder en el árbol (se busca por cédula o se crea).
 * El teléfono va cifrado y solo sale a pedido, de a uno (verTelefonoProspecto).
 */

import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection }   from '@/lib/tenant'
import { obtenerOCrearVoterDeUsuario } from '@/lib/voter-de-usuario'
import { getTenantDb, encrypt, decrypt } from '@vectra/db'
import { revalidatePath }        from 'next/cache'
import { fechasEtapa }           from './_lib/etapas'

const ROLES = ['ADMIN_CAMPANA', 'COORDINADOR'] as const
const RUTA  = '/core/estructura/prospectos'

export type Etapa = 'CANDIDATO' | 'CONVERSADO' | 'ACEPTO' | 'NO_ACEPTO'
type Resultado = { success: true } | { success: false; error: string }

export interface ProspectoView {
  id:            string
  nombre:        string
  notas:         string | null
  etapa:         Etapa
  tieneTelefono: boolean
  responsableId: string | null
  responsable:   string | null
  lider:         { nombre: string; conRed: boolean } | null // el Voter enlazado, si aceptó
  fechaEtapa:    Date
}

export interface EmbudoView {
  prospectos:   ProspectoView[]
  responsables: { id: string; nombre: string }[]
}

export interface ConteosProspectos {
  porEtapa:        Record<Etapa, number>
  aceptadosSinRed: number // aceptaron pero su Voter aún no tiene a nadie debajo
}

async function sesionYDb(accion: 'view' | 'edit') {
  const session  = await requireModuleOrScreen('CORE', [...ROLES], 'CORE_ESTRUCTURA', accion)
  const tenantId = session.user.tenantId
  return { tenantId, voterId: session.user.voterId, db: getTenantDb(await getTenantConnection(tenantId)) }
}

export async function getEmbudo(): Promise<EmbudoView> {
  const { tenantId, voterId, db } = await sesionYDb('view')
  const [filas, responsables] = await Promise.all([
    db.prospectoLider.findMany({
      where:   { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        responsable: { select: { name: true } },
        voter:       { select: { name: true, _count: { select: { followers: true } } } },
      },
    }),
    // Quien puede llevar prospectos: el candidato, quien ya tiene red y uno mismo.
    db.voter.findMany({
      where:   { tenantId, OR: [{ isCandidate: true }, { followers: { some: {} } }, ...(voterId ? [{ id: voterId }] : [])] },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])
  return {
    prospectos: filas.map((p) => ({
      id:            p.id,
      nombre:        p.nombre,
      notas:         p.notas,
      etapa:         p.etapa,
      tieneTelefono: Boolean(p.phone),
      responsableId: p.responsableId,
      responsable:   p.responsable?.name ?? null,
      lider:         p.voter ? { nombre: p.voter.name, conRed: p.voter._count.followers > 0 } : null,
      fechaEtapa:    p.decididoEn ?? p.conversadoEn ?? p.createdAt,
    })),
    responsables: responsables.map((v) => ({ id: v.id, nombre: v.name })),
  }
}

export async function getConteosProspectos(): Promise<ConteosProspectos> {
  const { tenantId, db } = await sesionYDb('view')
  const [grupos, aceptadosSinRed] = await Promise.all([
    db.prospectoLider.groupBy({ by: ['etapa'], where: { tenantId }, _count: true }),
    db.prospectoLider.count({ where: { tenantId, etapa: 'ACEPTO', voter: { followers: { none: {} } } } }),
  ])
  const porEtapa: Record<Etapa, number> = { CANDIDATO: 0, CONVERSADO: 0, ACEPTO: 0, NO_ACEPTO: 0 }
  for (const g of grupos) porEtapa[g.etapa] = g._count
  return { porEtapa, aceptadosSinRed }
}

export async function crearProspecto(input: { nombre: string; telefono?: string; notas?: string }): Promise<Resultado> {
  const { tenantId, voterId, db } = await sesionYDb('edit')
  const nombre   = input.nombre.trim()
  const telefono = input.telefono?.replace(/\D/g, '') ?? ''
  if (!nombre) return { success: false, error: 'Falta el nombre.' }
  if (telefono && !/^\d{7,12}$/.test(telefono)) return { success: false, error: 'El teléfono debe tener entre 7 y 12 dígitos.' }

  await db.prospectoLider.create({
    data: {
      tenantId, nombre,
      phone:         telefono ? encrypt(telefono) : null,
      notas:         input.notas?.trim() || null,
      responsableId: voterId,
    },
  })
  revalidatePath(RUTA)
  return { success: true }
}

/**
 * Mueve de etapa y fija la fecha del paso. Devolver a una etapa anterior borra
 * las fechas posteriores y desenlaza el Voter (el Voter no se toca). ACEPTO
 * exige cédula para encontrar o crear al Voter, salvo que ya esté enlazado.
 */
export async function moverProspecto(id: string, etapa: Etapa, cedula?: string): Promise<Resultado> {
  const { tenantId, db } = await sesionYDb('edit')
  const p = await db.prospectoLider.findFirst({ where: { id, tenantId } })
  if (!p) return { success: false, error: 'Prospecto no encontrado.' }

  let voterId: string | null = null
  if (etapa === 'ACEPTO') {
    voterId = p.voterId
    if (!voterId) {
      const r = await obtenerOCrearVoterDeUsuario(db, tenantId, { name: p.nombre, cedula: cedula ?? '' })
      if (!r.success) return r
      const otro = await db.prospectoLider.findFirst({ where: { voterId: r.voterId, NOT: { id } }, select: { nombre: true } })
      if (otro) return { success: false, error: `Esa cédula ya está enlazada al prospecto ${otro.nombre}.` }
      // Recién creado: hereda el teléfono (mismo cifrado que Voter.phone).
      if (!r.yaExistia && p.phone) await db.voter.update({ where: { id: r.voterId }, data: { phone: p.phone } })
      voterId = r.voterId
    }
  }

  await db.prospectoLider.update({
    where: { id },
    data: {
      etapa, voterId,
      ...fechasEtapa(p, etapa, new Date()),
    },
  })
  revalidatePath(RUTA)
  revalidatePath('/core/estructura')
  return { success: true }
}

export async function reasignarProspecto(id: string, responsableId: string | null): Promise<Resultado> {
  const { tenantId, db } = await sesionYDb('edit')
  if (responsableId && !(await db.voter.findFirst({ where: { id: responsableId, tenantId }, select: { id: true } }))) {
    return { success: false, error: 'Responsable no encontrado.' }
  }
  const { count } = await db.prospectoLider.updateMany({ where: { id, tenantId }, data: { responsableId } })
  if (!count) return { success: false, error: 'Prospecto no encontrado.' }
  revalidatePath(RUTA)
  return { success: true }
}

export async function borrarProspecto(id: string): Promise<Resultado> {
  const { tenantId, db } = await sesionYDb('edit')
  await db.prospectoLider.deleteMany({ where: { id, tenantId } })
  revalidatePath(RUTA)
  revalidatePath('/core/estructura')
  return { success: true }
}

/** Teléfono de un solo prospecto, a pedido — nunca viaja en el listado. */
export async function verTelefonoProspecto(id: string): Promise<string | null> {
  const { tenantId, db } = await sesionYDb('view')
  const p = await db.prospectoLider.findFirst({ where: { id, tenantId }, select: { phone: true } })
  return p?.phone ? decrypt(p.phone) : null
}
