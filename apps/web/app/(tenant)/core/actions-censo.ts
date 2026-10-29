'use server'

import { revalidatePath } from 'next/cache'
import { getTenantDb } from '@vectra/db'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { decrypt } from '@vectra/db'
import { censoConfigurado, guardarResultado, procesarCensoPendientes } from '@/lib/censo'
import type { ResultadoRegistraduria } from '@/lib/censo-registraduria'

const NO_CONFIGURADA = 'La API del censo no está configurada (CENSO_API_URL / CENSO_API_KEY).'

async function dbConPermiso() {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_ELECTORES', 'edit')
  const tenantId = session.user.tenantId
  return { tenantId, db: getTenantDb(await getTenantConnection(tenantId)) }
}

/**
 * Cédula en claro para que el navegador consulte a la Registraduría desde la
 * ficha. Mismo permiso que editar al elector, donde la cédula ya se ve.
 */
export async function cedulaParaCenso(voterId: string): Promise<string | null> {
  const { db, tenantId } = await dbConPermiso()
  const v = await db.voter.findFirst({ where: { id: voterId, tenantId }, select: { cedula: true } })
  return v ? decrypt(v.cedula) : null
}

const ESTADOS = new Set(['ENCONTRADO', 'NOVEDAD', 'NO_ENCONTRADO'])
const CAMPOS  = ['estado', 'departamento', 'municipio', 'puesto', 'direccion', 'mesa', 'latitud', 'longitud', 'mapa_url', 'mensaje']

/**
 * Guarda lo que el navegador trajo de la Registraduría (lib/censo-registraduria).
 * Viene del cliente: solo pasan los campos conocidos, texto corto o número finito.
 * null = la consulta falló y el elector queda en ERROR.
 */
export async function guardarCensoRegistraduria(
  voterId: string, r: ResultadoRegistraduria | null,
): Promise<{ success: boolean; error?: string }> {
  const { db, tenantId } = await dbConPermiso()
  if (!await db.voter.findFirst({ where: { id: voterId, tenantId }, select: { id: true } })) {
    return { success: false, error: 'Elector no encontrado.' }
  }

  if (!r || !ESTADOS.has(r.estado)) {
    await db.voter.update({ where: { id: voterId }, data: { censoEstado: 'ERROR', censoVerificadoEn: new Date() } })
  } else {
    const lugar: Record<string, string | number> = {}
    for (const k of CAMPOS) {
      const v = r.lugar?.[k]
      if (typeof v === 'string' && v.length <= 300) lugar[k] = v
      else if (typeof v === 'number' && Number.isFinite(v)) lugar[k] = v
    }
    await guardarResultado(db, voterId, { estado: r.estado, lugar })
  }

  revalidatePath(`/core/electores/${voterId}`)
  return { success: true }
}

/** Listado: un lote de hasta 200 sobre el padrón. Se repite hasta que no queden. */
export async function verificarPadronCenso(): Promise<
  { success: true; encolados: number; revisados: number; restantes: number } | { success: false; error: string }
> {
  const { db, tenantId } = await dbConPermiso()
  if (!censoConfigurado()) return { success: false, error: NO_CONFIGURADA }

  const r = await procesarCensoPendientes(db, tenantId, 200)
  revalidatePath('/core/electores')
  return { success: true, ...r }
}
