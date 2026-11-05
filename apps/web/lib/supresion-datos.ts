/**
 * Supresión y revocación (Ley 1581, art. 15). Suprimir = que la persona deje de
 * ser identificable. No se borra la fila: quienes ella registró cuelgan de su
 * nodo en el árbol (leaderId) y borrarla rompería la red de otros. Se borran o
 * vacían todos sus datos personales y lo que dijo; queda un nodo anónimo.
 * La prueba de la autorización se conserva (revocada) para responder ante la SIC.
 */

import { createHash } from 'crypto'
import { encrypt, superadminDb, Prisma, type getTenantDb } from '@vectra/db'

type Db = ReturnType<typeof getTenantDb>

export async function revocarAutorizacion(db: Db, tenantId: string, voterId: string): Promise<void> {
  const ahora = new Date()
  await db.$transaction([
    db.autorizacionDatos.updateMany({ where: { tenantId, voterId, revocadaEn: null }, data: { revocadaEn: ahora } }),
    db.voter.updateMany({ where: { id: voterId, tenantId }, data: { autorizacionDatosEn: null } }),
  ])
}

export async function suprimirElector(db: Db, tenantId: string, voterId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = await db.voter.findFirst({ where: { id: voterId, tenantId }, select: { id: true, isCandidate: true } })
  if (!v) return { ok: false, error: 'El elector ya no existe.' }
  if (v.isCandidate) return { ok: false, error: 'Es el candidato de la campaña: no se suprime desde aquí.' }
  const cuenta = await superadminDb.user.findFirst({ where: { tenantId, voterId }, select: { email: true } })
  if (cuenta) return { ok: false, error: `Tiene una cuenta de Vectra (${cuenta.email}). Desactívala o bórrala primero en Usuarios.` }

  const marca = `suprimido:${voterId}`
  const ahora = new Date()
  await db.$transaction([
    db.voter.update({
      where: { id: voterId },
      data: {
        name: 'Titular suprimido', apodo: null, phone: null, telefonoHash: null, address: null, lat: null, lng: null,
        birthDate: null, notes: null, censoEstado: null, censoLugar: Prisma.DbNull, censoJobId: null,
        // La cédula es obligatoria y única: se reemplaza por una marca que no identifica a nadie.
        cedula: encrypt(marca), cedulaHash: createHash('sha256').update(marca).digest('hex'),
        status: 'INACTIVO', esSimpatizante: false, autorizacionDatosEn: null, consent: false,
      },
    }),
    db.autorizacionDatos.updateMany({ where: { tenantId, voterId, revocadaEn: null }, data: { revocadaEn: ahora } }),
    db.perfilSimpatizante.deleteMany({ where: { voterId } }),
    db.surveyResponse.deleteMany({ where: { voterId } }),
    db.surveyMessageLog.deleteMany({ where: { voterId } }),
    db.voterPushSubscription.deleteMany({ where: { voterId } }),
    db.compromisoAnalysis.deleteMany({ where: { tenantId, voterId } }),
    db.conversacion.deleteMany({ where: { tenantId, voterId } }), // sus mensajes caen en cascada
    db.contactoCalle.updateMany({ where: { tenantId, voterId }, data: { nombre: null, telefono: null, telefonoHash: null, nota: null } }),
    db.message.updateMany({ where: { tenantId, recipientId: voterId }, data: { to: null, body: '(suprimido)' } }),
  ])
  return { ok: true }
}
