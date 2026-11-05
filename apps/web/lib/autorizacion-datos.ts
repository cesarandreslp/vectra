/**
 * Autorización de datos personales (Ley 1581 de 2012, Decreto 1377 de 2013).
 * La autorización debe ser previa, expresa e informada, y hay que poder
 * probarla: cada una queda en AutorizacionDatos con el texto exacto que la
 * persona vio. La afinidad política es dato sensible: se avisa que es opcional.
 */

import type { getTenantDb } from '@vectra/db'

type Db = ReturnType<typeof getTenantDb>
export type CanalAutorizacion = 'ENLACE' | 'ALTA_MANUAL' | 'IMPORTACION' | 'PWA'

/**
 * Texto sugerido mientras la campaña no escriba el suyo. Cubre lo que pide la
 * ley (responsable, datos, finalidad, dato sensible opcional, derechos y cómo
 * ejercerlos), pero la campaña es la responsable: que lo revise su asesor legal.
 */
export function textoSugerido(campana: string, contacto: string | null): string {
  const donde = contacto?.trim() ? `escribiendo a ${contacto.trim()}` : 'comunicándome con la campaña'
  return `Autorizo a ${campana}, como responsable del tratamiento, a recolectar, almacenar y usar mis datos personales ` +
    `(nombre, cédula, celular, dirección y lugar de votación) para informarme sobre la campaña, invitarme a sus ` +
    `actividades y organizar su trabajo electoral. Sé que mi opinión o afinidad política es un dato sensible y que no ` +
    `estoy obligado(a) a suministrarla. Puedo conocer, actualizar, rectificar y suprimir mis datos, y revocar esta ` +
    `autorización, ${donde}. (Ley 1581 de 2012 y Decreto 1377 de 2013.)`
}

/** El texto vigente de la campaña: el que escribió, o el sugerido. */
export async function textoAutorizacion(db: Db, tenantId: string, campana: string): Promise<string> {
  const c = await db.tenantConfig.findUnique({ where: { tenantId }, select: { autorizacionTexto: true, autorizacionContacto: true } })
  return c?.autorizacionTexto?.trim() || textoSugerido(campana, c?.autorizacionContacto ?? null)
}

/**
 * Guarda la prueba y marca a los electores como autorizados. Solo a quienes no
 * tenían autorización vigente: aceptar dos veces no duplica la prueba.
 */
export async function registrarAutorizacion(db: Db, p: {
  tenantId: string; voterIds: string[]; canal: CanalAutorizacion; texto: string
  ip?: string | null; declaradaPorId?: string | null
}): Promise<number> {
  const pendientes = await db.voter.findMany({
    where:  { tenantId: p.tenantId, id: { in: [...new Set(p.voterIds)] }, autorizacionDatosEn: null },
    select: { id: true },
  })
  if (!pendientes.length) return 0
  const ids = pendientes.map((v) => v.id)
  const ahora = new Date()
  await db.$transaction([
    db.autorizacionDatos.createMany({
      data: ids.map((voterId) => ({
        tenantId: p.tenantId, voterId, canal: p.canal, texto: p.texto,
        ip: p.ip ?? null, declaradaPorId: p.declaradaPorId ?? null, fecha: ahora,
      })),
    }),
    db.voter.updateMany({ where: { id: { in: ids } }, data: { autorizacionDatosEn: ahora } }),
  ])
  return ids.length
}
