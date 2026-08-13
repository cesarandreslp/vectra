'use server'

/**
 * Server Actions públicas para el registro de electores por QR.
 * No requieren autenticación — el elector llega desde el celular.
 *
 * Seguridad:
 *   - El token siempre lo genera el servidor (crypto.randomUUID())
 *   - captureDepth siempre lo calcula el servidor
 *   - La cédula nunca se expone; solo se guarda cifrada + su SHA-256
 *   - Nunca se revela con qué líder está registrada una cédula si ya existe
 */

import { createHash, randomUUID } from 'crypto'
import { headers }                from 'next/headers'
import { superadminDb, getTenantDb, encrypt } from '@vectra/db'
import { getTenantConnection }    from '@/lib/tenant'
import { crearAlertaDuplicado }   from '@/app/(tenant)/core/actions'
import { crearQrPropio }          from '@/lib/qr'
import { verificarRateLimit }     from './_lib/rate-limit'

export interface RegistroQRInput {
  nombre:     string
  apodo?:     string
  cedula:     string
  telefono?:  string
  direccion?: string
  puestoId?:  string
  mesaId?:    string
}

export type RegistroQRResult =
  | { success: true;  message: string; voterId?: string; qrToken?: string }
  | { success: false; error: string }

/**
 * Registra un elector mediante un QR de captación.
 * Lógica completa de deduplicación y árbol de referidos.
 */
export async function registrarseConQR(
  slug:      string, // slug del tenant (parámetro ?c= de la URL del QR)
  token:     string,
  data:      RegistroQRInput,
  refId?:    string,  // voterId del referidor (parámetro ?ref= de la URL)
): Promise<RegistroQRResult> {
  // ── Rate limiting por IP ────────────────────────────────────────────────────
  const headersList = await headers()
  const ip = (
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    '0.0.0.0'
  )

  if (!verificarRateLimit(ip)) {
    return { success: false, error: 'Demasiados intentos. Por favor intenta más tarde.' }
  }

  // ── Resolver tenant por slug ──────────────────────────────────────────────────
  // El slug viene en ?c= de la URL del QR; se resuelve contra la DB del superadmin
  // (las rutas públicas no pasan por la resolución de tenant del middleware).
  const tenant = await superadminDb.tenant.findUnique({
    where:  { slug },
    select: { id: true, isActive: true },
  })
  if (!tenant || !tenant.isActive) {
    return { success: false, error: 'Enlace no válido.' }
  }
  const tenantId = tenant.id

  let connectionString: string
  try {
    connectionString = await getTenantConnection(tenantId)
  } catch {
    return { success: false, error: 'Enlace no válido.' }
  }

  const db = getTenantDb(connectionString)

  const qr = await db.qrRegistration.findFirst({
    where: { token, tenantId, isActive: true },
  })

  if (!qr) {
    return { success: false, error: 'Este enlace ya no está disponible.' }
  }

  if (qr.expiresAt && qr.expiresAt < new Date()) {
    return { success: false, error: 'Este enlace ha expirado.' }
  }

  // ── Validar datos requeridos ────────────────────────────────────────────────
  const nombre = data.nombre?.trim()
  const cedula = data.cedula?.trim()

  if (!nombre || !cedula) {
    return { success: false, error: 'Nombre y cédula son obligatorios.' }
  }

  // ── Deduplicación por SHA-256 ───────────────────────────────────────────────
  const cedulaHash = createHash('sha256').update(cedula).digest('hex')

  const existente = await db.voter.findFirst({
    where:  { tenantId, cedulaHash },
    select: { id: true, name: true, leaderId: true },
  })

  if (existente) {
    if (existente.leaderId === qr.leaderId) {
      // Ya registrado con este mismo líder — mensaje amigable sin datos sensibles
      return {
        success: true,
        message: `¡Hola ${existente.name}! Ya estás registrado. Gracias por tu apoyo.`,
        voterId: existente.id,
      }
    }

    // Registrado con otro líder — crear alerta sin revelar con quién
    await crearAlertaDuplicado(
      {
        tenantId,
        cedulaHash,
        firstLeaderId:     existente.leaderId ?? qr.leaderId,
        duplicateLeaderId: qr.leaderId,
      },
      db as any,
    )

    // Respuesta genérica que NO revela información del otro líder
    return {
      success: true,
      message: 'Tu información ya está en el sistema. Gracias.',
    }
  }

  // ── Resolver árbol de referidos ─────────────────────────────────────────────
  let captureDepth   = 0
  let referredById: string | undefined

  if (refId) {
    const referidor = await db.voter.findFirst({
      where:  { id: refId, tenantId, leaderId: qr.leaderId },
      select: { id: true, captureDepth: true },
    })
    if (referidor) {
      captureDepth = referidor.captureDepth + 1
      referredById = referidor.id
    }
    // Si el referidor no existe o es de otro líder: ignorar, registrar como depth 0
  }

  // ── Crear elector ───────────────────────────────────────────────────────────
  const nuevoElector = await db.voter.create({
    data: {
      tenantId,
      cedula:       encrypt(cedula),
      cedulaHash,
      name:         nombre,
      apodo:        data.apodo?.trim() || undefined,
      phone:        data.telefono ? encrypt(data.telefono) : undefined,
      address:      data.direccion || undefined,
      leaderId:     qr.leaderId,
      votingTableId: data.mesaId || undefined,
      qrTokenUsed:  token,
      captureDepth,
      referredById,
    },
    select: { id: true },
  })
  // Su propio QR queda listo de inmediato para que, si a su vez capta a
  // alguien, esa persona quede bajo él — sin esperar a que "sea líder".
  const qrTokenPropio = await crearQrPropio(nuevoElector.id, tenantId, db)

  // Incrementar contador de registros del QR
  await db.qrRegistration.update({
    where: { id: qr.id },
    data:  { registrationsCount: { increment: 1 } },
  })

  return {
    success: true,
    message: `¡Gracias ${nombre}! Quedaste registrado exitosamente.`,
    voterId: nuevoElector.id,
    qrToken: qrTokenPropio,
  }
}

/**
 * Genera un nuevo QR de captación para un líder.
 * Solo lo puede llamar el servidor — el token siempre lo genera el servidor.
 */
export async function generarQR(
  leaderId: string,
  tenantId: string,
  expiresAt?: Date,
): Promise<{ success: true; token: string; qrId: string } | { success: false; error: string }> {
  try {
    const connectionString = await getTenantConnection(tenantId)
    const db               = getTenantDb(connectionString)

    // El token siempre lo genera el servidor
    const token = randomUUID()

    const qr = await db.qrRegistration.create({
      data: { tenantId, leaderId, token, expiresAt: expiresAt ?? null },
    })

    return { success: true, token: qr.token, qrId: qr.id }
  } catch (err) {
    console.error('[generarQR]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al generar el QR.' }
  }
}

/**
 * Alterna el estado activo/inactivo de un QR.
 */
export async function toggleQR(
  qrId:    string,
  tenantId: string,
): Promise<{ success: boolean; isActive?: boolean }> {
  try {
    const connectionString = await getTenantConnection(tenantId)
    const db               = getTenantDb(connectionString)

    const qr = await db.qrRegistration.findFirst({
      where:  { id: qrId, tenantId },
      select: { isActive: true },
    })
    if (!qr) return { success: false }

    const actualizado = await db.qrRegistration.update({
      where:  { id: qrId },
      data:   { isActive: !qr.isActive },
      select: { isActive: true },
    })

    return { success: true, isActive: actualizado.isActive }
  } catch (err) {
    console.error('[toggleQR]', err instanceof Error ? err.message : err)
    return { success: false }
  }
}
