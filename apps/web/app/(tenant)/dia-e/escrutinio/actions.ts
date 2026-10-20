'use server'

import { revalidatePath } from 'next/cache'
import { getTenantDb } from '@vectra/db'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import {
  CLAVE_BLANCO, CLAVE_NULOS, datosDeTransmision, votosDeE14, diferencias, totalVotos, type Votos,
} from '@/lib/escrutinio'

/** Motivos con los que la comisión cambia un conteo — van al historial y a la reclamación. */
const MOTIVOS = [
  'Reconteo de votos', 'Error aritmético en el E-14', 'Reclamación aceptada',
  'Votos nulos o válidos reclasificados', 'Acta con tachones o enmendaduras', 'Otro',
]

async function contexto(accion: 'view' | 'edit' = 'view') {
  const session  = await requireModuleOrScreen('DIA_E', ['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_ESCRUTINIO', accion)
  const tenantId = session.user.tenantId
  return {
    db: getTenantDb(await getTenantConnection(tenantId)), tenantId, userId: session.user.userId,
    nombre: session.user.name ?? session.user.email ?? 'Usuario',
  }
}

export type EstadoMesa = 'PENDIENTE' | 'REVISADA' | 'CORREGIDA'

export interface MesaEscrutinio {
  id:         string
  puesto:     string
  mesa:       number
  totalE14:   number | null
  totalEscrutinio: number | null
  estado:     EstadoMesa
}

export async function getMotivos(): Promise<string[]> {
  return MOTIVOS
}

/** Mesas de la zona (o de todo el municipio) con su estado en el escrutinio. */
export async function listMesasEscrutinio(zonaId: string | null): Promise<{
  zonas: { id: string; code: string; name: string | null }[]
  mesas: MesaEscrutinio[]
}> {
  const { db, tenantId } = await contexto()
  const [zonas, mesas, candidatos, transmisiones, escrutinios] = await Promise.all([
    db.zona.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
    db.votingTable.findMany({
      where:  zonaId ? { station: { zonaId } } : {},
      select: { id: true, number: true, station: { select: { name: true } } },
    }),
    db.candidate.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    db.e14Transmission.findMany({ where: { tenantId }, select: { votingTableId: true, finalData: true, manualData: true, extractedData: true } }),
    db.escrutinioMesa.findMany({ where: { tenantId }, select: { votingTableId: true, datos: true, estado: true } }),
  ])
  const e14 = new Map(transmisiones.map((t) => [t.votingTableId, votosDeE14(datosDeTransmision(t), candidatos)]))
  const esc = new Map(escrutinios.map((e) => [e.votingTableId, e]))

  return {
    zonas,
    mesas: mesas
      .map((m) => {
        const v14 = e14.get(m.id) ?? null
        const e = esc.get(m.id)
        return {
          id: m.id, puesto: m.station.name, mesa: m.number,
          totalE14: v14 ? totalVotos(v14) : null,
          totalEscrutinio: e ? totalVotos(e.datos as Votos) : null,
          estado: (e?.estado as EstadoMesa | undefined) ?? 'PENDIENTE',
        }
      })
      .sort((a, b) => a.puesto.localeCompare(b.puesto) || a.mesa - b.mesa),
  }
}

export interface DetalleMesaEscrutinio {
  id: string; puesto: string; mesa: number
  filas: { clave: string; nombre: string; agrupacion: string | null; e14: number | null; escrutinio: number }[]
  estado: EstadoMesa
  historial: { at: string; por: string; motivo: string; observacion: string; cambios: { clave: string; antes: number; despues: number }[] }[]
}

export async function getMesaEscrutinio(votingTableId: string): Promise<DetalleMesaEscrutinio | null> {
  const { db, tenantId } = await contexto()
  const [mesa, candidatos, tx, esc] = await Promise.all([
    db.votingTable.findUnique({ where: { id: votingTableId }, select: { id: true, number: true, station: { select: { name: true } } } }),
    db.candidate.findMany({ where: { tenantId }, select: { id: true, name: true, party: true }, orderBy: { order: 'asc' } }),
    db.e14Transmission.findFirst({ where: { tenantId, votingTableId }, select: { finalData: true, manualData: true, extractedData: true } }),
    db.escrutinioMesa.findFirst({ where: { tenantId, votingTableId } }),
  ])
  if (!mesa) return null

  const v14 = tx ? votosDeE14(datosDeTransmision(tx), candidatos) : null
  const vEsc = (esc?.datos as Votos | undefined) ?? v14 ?? {}
  const filas = [
    ...candidatos.map((c) => ({ clave: c.id, nombre: c.name, agrupacion: c.party })),
    { clave: CLAVE_BLANCO, nombre: 'Votos en blanco', agrupacion: null },
    { clave: CLAVE_NULOS,  nombre: 'Votos nulos',     agrupacion: null },
  ].map((f) => ({ ...f, e14: v14 ? v14[f.clave] ?? 0 : null, escrutinio: vEsc[f.clave] ?? 0 }))

  return {
    id: mesa.id, puesto: mesa.station.name, mesa: mesa.number, filas,
    estado: (esc?.estado as EstadoMesa | undefined) ?? 'PENDIENTE',
    historial: (esc?.historial as DetalleMesaEscrutinio['historial'] | undefined) ?? [],
  }
}

/**
 * Registra lo que dejó la comisión en esta mesa. Sin cambios frente al E-14 →
 * REVISADA; con cambios → CORREGIDA y exige motivo. Cada guardado con cambios
 * entra al historial (frente al último valor guardado, no solo al E-14).
 */
export async function guardarEscrutinio(
  votingTableId: string, valores: Votos, motivo: string, observacion: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { db, tenantId, userId, nombre } = await contexto('edit')
    const mesa = await db.votingTable.findUnique({ where: { id: votingTableId }, select: { id: true } })
    if (!mesa) return { success: false, error: 'Mesa no encontrada.' }

    const limpios: Votos = {}
    for (const [k, n] of Object.entries(valores)) {
      if (!Number.isInteger(n) || n < 0) return { success: false, error: 'Los votos deben ser números enteros, sin negativos.' }
      limpios[k] = n
    }

    const [candidatos, tx, previo] = await Promise.all([
      db.candidate.findMany({ where: { tenantId }, select: { id: true, name: true } }),
      db.e14Transmission.findFirst({ where: { tenantId, votingTableId }, select: { finalData: true, manualData: true, extractedData: true } }),
      db.escrutinioMesa.findFirst({ where: { tenantId, votingTableId } }),
    ])
    const v14 = (tx ? votosDeE14(datosDeTransmision(tx), candidatos) : null) ?? {}
    const base = (previo?.datos as Votos | undefined) ?? v14
    const cambios = diferencias(base, limpios)
    const corregida = diferencias(v14, limpios).length > 0

    if (cambios.length > 0 && !MOTIVOS.includes(motivo)) return { success: false, error: 'Elige el motivo de la corrección.' }

    const historial = (previo?.historial as DetalleMesaEscrutinio['historial'] | undefined) ?? []
    if (cambios.length > 0) historial.push({ at: new Date().toISOString(), por: nombre, motivo, observacion: observacion.trim(), cambios })

    const datos = { datos: limpios, estado: corregida ? 'CORREGIDA' : 'REVISADA', historial, updatedBy: userId }
    await db.escrutinioMesa.upsert({
      where:  { votingTableId },
      update: datos,
      create: { tenantId, votingTableId, ...datos },
    })

    revalidatePath('/dia-e/escrutinio')
    revalidatePath(`/dia-e/escrutinio/${votingTableId}`)
    return { success: true }
  } catch (err) {
    console.error('[guardarEscrutinio]', err instanceof Error ? err.message : err)
    return { success: false, error: 'No se pudo guardar el escrutinio de la mesa.' }
  }
}
