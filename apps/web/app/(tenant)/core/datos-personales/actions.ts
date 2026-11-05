'use server'

/** Solicitudes de titulares (Ley 1581): el equipo las atiende antes de que venza el plazo legal. */

import { revalidatePath } from 'next/cache'
import { getTenantDb, decrypt } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { revocarAutorizacion, suprimirElector } from '@/lib/supresion-datos'

export interface FilaSolicitud {
  id: string; tipo: string; nombre: string; contacto: string; detalle: string; estado: string
  venceEn: string; createdAt: string; vencida: boolean
  elector: { id: string; nombre: string } | null
  respuesta: string | null; accion: string | null; atendidaEn: string | null
}

type Resultado = { success: true } | { success: false; error: string }

async function sesionYDb(accion: 'view' | 'edit') {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA'], 'CORE_DATOS_PERSONALES', accion)
  return { session, tenantId: session.user.tenantId, db: getTenantDb(await getTenantConnection(session.user.tenantId)) }
}

export async function listSolicitudes(): Promise<FilaSolicitud[]> {
  const { tenantId, db } = await sesionYDb('view')
  const ss = await db.solicitudDatos.findMany({ where: { tenantId }, orderBy: [{ estado: 'desc' }, { venceEn: 'asc' }], take: 300 })
  const voters = await db.voter.findMany({
    where: { id: { in: ss.map((s) => s.voterId).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true },
  })
  const nombre = new Map(voters.map((v) => [v.id, v.name]))
  const ahora = Date.now()
  return ss.map((s) => {
    let contacto = ''
    try { contacto = decrypt(s.contacto) } catch { contacto = '(ilegible)' }
    return {
      id: s.id, tipo: s.tipo, nombre: s.nombre, contacto, detalle: s.detalle, estado: s.estado,
      venceEn: s.venceEn.toISOString(), createdAt: s.createdAt.toISOString(),
      vencida: s.estado === 'RECIBIDA' && s.venceEn.getTime() < ahora,
      elector: s.voterId && nombre.has(s.voterId) ? { id: s.voterId, nombre: nombre.get(s.voterId)! } : null,
      respuesta: s.respuesta, accion: s.accion, atendidaEn: s.atendidaEn?.toISOString() ?? null,
    }
  })
}

/**
 * Cierra la solicitud. `accion` solo se ejecuta si la solicitud es de ese tipo y
 * hay elector: el equipo ya verificó por el contacto que quien pide es el titular.
 */
export async function atenderSolicitud(id: string, respuesta: string, accion: 'NINGUNA' | 'REVOCAR' | 'SUPRIMIR'): Promise<Resultado> {
  const { session, tenantId, db } = await sesionYDb('edit')
  const s = await db.solicitudDatos.findFirst({ where: { id, tenantId, estado: 'RECIBIDA' } })
  if (!s) return { success: false, error: 'La solicitud no existe o ya fue atendida.' }
  const texto = typeof respuesta === 'string' ? respuesta.trim().slice(0, 3000) : ''
  if (!texto) return { success: false, error: 'Escribe lo que se le respondió al titular.' }

  let hecho = 'NINGUNA'
  if (accion !== 'NINGUNA') {
    if (!s.voterId) return { success: false, error: 'Esa cédula no está en el padrón: no hay datos que revocar ni suprimir.' }
    if (accion === 'SUPRIMIR') {
      if (s.tipo !== 'SUPRESION') return { success: false, error: 'Solo una solicitud de supresión borra datos.' }
      const r = await suprimirElector(db, tenantId, s.voterId)
      if (!r.ok) return { success: false, error: r.error }
      hecho = 'SUPRIMIDO'
    } else {
      if (s.tipo !== 'REVOCACION' && s.tipo !== 'SUPRESION') return { success: false, error: 'Solo una solicitud de revocación o supresión retira la autorización.' }
      await revocarAutorizacion(db, tenantId, s.voterId)
      hecho = 'REVOCADA'
    }
  }

  await db.solicitudDatos.update({
    where: { id },
    data: { estado: 'ATENDIDA', respuesta: texto, accion: hecho, atendidaEn: new Date(), atendidaPorId: session.user.userId },
  })
  revalidatePath('/core/datos-personales')
  return { success: true }
}
