'use server'

/**
 * Formulario público de derechos del titular (Ley 1581). Sin sesión: el titular
 * puede no tener cuenta. Nunca revela si la cédula está o no en el padrón.
 */

import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { superadminDb, getTenantDb, encrypt } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { TIPOS_SOLICITUD, diasDePlazo, sumarDiasHabiles, type TipoSolicitud } from '@/lib/politica-datos'
import { verificarRateLimit } from '@/app/registro/[token]/_lib/rate-limit'

export interface SolicitudInput {
  tipo: string; cedula: string; nombre: string; contacto: string; detalle: string
}

export async function enviarSolicitud(
  slug: string, data: SolicitudInput,
): Promise<{ success: true; vence: string } | { success: false; error: string }> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? '0.0.0.0'
  if (!verificarRateLimit(`privacidad:${ip}`)) return { success: false, error: 'Demasiados intentos. Intenta más tarde.' }

  const tipo = data?.tipo as TipoSolicitud
  const cedula = String(data?.cedula ?? '').replace(/\D/g, '')
  const nombre = String(data?.nombre ?? '').trim().slice(0, 120)
  const contacto = String(data?.contacto ?? '').trim().slice(0, 120)
  const detalle = String(data?.detalle ?? '').trim().slice(0, 2000)
  if (!(tipo in TIPOS_SOLICITUD)) return { success: false, error: 'Elige qué quieres hacer.' }
  if (cedula.length < 5 || cedula.length > 12) return { success: false, error: 'Escribe tu número de cédula.' }
  if (!nombre) return { success: false, error: 'Escribe tu nombre.' }
  if (!/@/.test(contacto) && contacto.replace(/\D/g, '').length < 7) {
    return { success: false, error: 'Deja un correo o un celular para responderte.' }
  }

  const tenant = await superadminDb.tenant.findUnique({ where: { slug }, select: { id: true, isActive: true } })
  if (!tenant?.isActive) return { success: false, error: 'Campaña no encontrada.' }
  const db = getTenantDb(await getTenantConnection(tenant.id))

  // Mismo hash que Voter.cedulaHash: así se encuentra al elector sin descifrar nada.
  const cedulaHash = createHash('sha256').update(cedula).digest('hex')
  const voter = await db.voter.findFirst({ where: { tenantId: tenant.id, cedulaHash }, select: { id: true } })
  const venceEn = sumarDiasHabiles(new Date(), diasDePlazo(tipo))

  const s = await db.solicitudDatos.create({
    data: {
      tenantId: tenant.id, tipo, cedulaHash, voterId: voter?.id ?? null, nombre,
      contacto: encrypt(contacto), detalle: detalle || TIPOS_SOLICITUD[tipo], venceEn,
    },
    select: { id: true },
  })

  // Aviso a los administradores: el plazo legal ya corre.
  const admins = await superadminDb.user.findMany({ where: { tenantId: tenant.id, role: 'ADMIN_CAMPANA', isActive: true }, select: { id: true } })
  if (admins.length) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        tenantId: tenant.id, userId: a.id, type: 'SOLICITUD_DATOS',
        message: `Solicitud de un titular (${TIPOS_SOLICITUD[tipo].toLowerCase()}). Vence el ${venceEn.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}.`,
        metadata: { solicitudId: s.id, href: '/core/datos-personales' },
      })),
    })
  }

  return { success: true, vence: venceEn.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric' }) }
}
