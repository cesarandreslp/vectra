'use server'

import { revalidatePath } from 'next/cache'
import { getTenantDb } from '@vectra/db'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { decrypt } from '@vectra/db'
import { censoConfigurado, guardarResultado, procesarCensoPendientes } from '@/lib/censo'
import type { PuestoConocido, ResultadoRegistraduria } from '@/lib/censo-registraduria'

const NO_CONFIGURADA = 'La API del censo no está configurada (CENSO_API_URL / CENSO_API_KEY).'

async function dbConPermiso() {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_ELECTORES', 'edit')
  const tenantId = session.user.tenantId
  return { tenantId, db: getTenantDb(await getTenantConnection(tenantId)) }
}

/**
 * Lo que necesita la consulta asistida: la cédula en claro para copiarla a la
 * página oficial (mismo permiso que editar al elector, donde ya se ve) y los
 * puestos de la campaña, para elegir de una lista en vez de digitar.
 */
export async function datosConsultaAsistida(
  voterId: string,
): Promise<{ cedula: string; puestos: PuestoConocido[] } | null> {
  const { db, tenantId } = await dbConPermiso()
  const v = await db.voter.findFirst({ where: { id: voterId, tenantId }, select: { cedula: true } })
  if (!v) return null
  const puestos = await db.votingStation.findMany({
    select:  { name: true, municipality: { select: { name: true, department: { select: { name: true } } } } },
    orderBy: { name: 'asc' },
  })
  return {
    cedula:  decrypt(v.cedula),
    puestos: puestos.map((p) => ({
      nombre: p.name, municipio: p.municipality.name, departamento: p.municipality.department.name,
    })),
  }
}

const ESTADOS = new Set(['ENCONTRADO', 'NOVEDAD', 'NO_ENCONTRADO'])
const CAMPOS  = ['estado', 'departamento', 'municipio', 'puesto', 'direccion', 'mesa', 'latitud', 'longitud', 'mapa_url', 'mensaje']

/**
 * Guarda lo que la persona vio en la página oficial (lib/censo-registraduria).
 * Viene del cliente: solo pasan los campos conocidos, texto corto o número finito.
 */
export async function guardarCensoRegistraduria(
  voterId: string, r: ResultadoRegistraduria,
): Promise<{ success: boolean; error?: string }> {
  const { db, tenantId } = await dbConPermiso()
  if (!await db.voter.findFirst({ where: { id: voterId, tenantId }, select: { id: true } })) {
    return { success: false, error: 'Elector no encontrado.' }
  }
  if (!ESTADOS.has(r?.estado)) return { success: false, error: 'Resultado inválido.' }

  const lugar: Record<string, string | number> = {}
  for (const k of CAMPOS) {
    const v = r.lugar?.[k]
    if (typeof v === 'string' && v.trim() && v.length <= 300) lugar[k] = v.trim()
    else if (typeof v === 'number' && Number.isFinite(v)) lugar[k] = v
  }
  if (r.estado === 'ENCONTRADO' && (!lugar.puesto || !lugar.mesa)) {
    return { success: false, error: 'Falta el puesto o la mesa.' }
  }
  await guardarResultado(db, voterId, { estado: r.estado, lugar })

  revalidatePath(`/core/electores/${voterId}`)
  return { success: true }
}

/** Electores sin resultado del censo: la tanda que recorre la cola de verificación. */
export async function electoresSinVerificar(limite = 150): Promise<{ id: string; name: string }[]> {
  const { db, tenantId } = await dbConPermiso()
  return db.voter.findMany({
    where:   { tenantId, OR: [{ censoEstado: null }, { censoEstado: { in: ['PENDIENTE', 'ERROR'] } }] },
    select:  { id: true, name: true },
    orderBy: { name: 'asc' },
    take:    limite,
  })
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
