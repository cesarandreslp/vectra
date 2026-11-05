'use server'

/**
 * Doble factor (TOTP) de la cuenta propia: activar escaneando un QR y
 * confirmando un código, o desactivar con un código vigente. Sirve a toda
 * cuenta con correo y contraseña (equipo de campaña y superadmin).
 */

import QRCode from 'qrcode'
import { superadminDb, encrypt, decrypt } from '@vectra/db'
import { nuevoSecreto, verificarTotp, uriTotp } from '@vectra/auth'
import { requireAuth } from '@/lib/auth-helpers'
import { registrarEvento } from '@/lib/bitacora'

const ROLES = ['SUPERADMIN', 'OPERADOR', 'ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'PERSONALIZADO'] as const
type Resultado = { success: true } | { success: false; error: string }

async function cuenta() {
  const session = await requireAuth([...ROLES])
  const u = await superadminDb.user.findUnique({
    where: { id: session.user.userId }, select: { id: true, email: true, totpSecreto: true, totpActivadoEn: true },
  })
  if (!u) throw new Error('Cuenta no encontrada')
  return { session, u }
}

export async function getDobleFactor(): Promise<{ activo: boolean }> {
  const { u } = await cuenta()
  return { activo: Boolean(u.totpActivadoEn) }
}

/** Propone un secreto nuevo (todavía no activo): el QR para escanear y la clave para escribir a mano. */
export async function iniciarDobleFactor(): Promise<{ qr: string; clave: string } | { error: string }> {
  const { u } = await cuenta()
  if (u.totpActivadoEn) return { error: 'Ya está activo. Desactívalo primero si quieres cambiar de celular.' }
  const secreto = nuevoSecreto()
  await superadminDb.user.update({ where: { id: u.id }, data: { totpSecreto: encrypt(secreto) } })
  return { qr: await QRCode.toDataURL(uriTotp(secreto, u.email), { margin: 1, width: 220 }), clave: secreto.match(/.{1,4}/g)!.join(' ') }
}

export async function confirmarDobleFactor(codigo: string): Promise<Resultado> {
  const { session, u } = await cuenta()
  if (!u.totpSecreto || u.totpActivadoEn) return { success: false, error: 'Empieza de nuevo la activación.' }
  if (!verificarTotp(decrypt(u.totpSecreto), String(codigo ?? ''))) return { success: false, error: 'Código incorrecto. Revisa que la hora del celular esté bien.' }
  await superadminDb.user.update({ where: { id: u.id }, data: { totpActivadoEn: new Date() } })
  await registrarEvento(session, 'ACTIVAR_DOBLE_FACTOR')
  return { success: true }
}

export async function desactivarDobleFactor(codigo: string): Promise<Resultado> {
  const { session, u } = await cuenta()
  if (!u.totpSecreto || !u.totpActivadoEn) return { success: false, error: 'No está activo.' }
  if (!verificarTotp(decrypt(u.totpSecreto), String(codigo ?? ''))) return { success: false, error: 'Código incorrecto.' }
  await superadminDb.user.update({ where: { id: u.id }, data: { totpSecreto: null, totpActivadoEn: null } })
  await registrarEvento(session, 'DESACTIVAR_DOBLE_FACTOR')
  return { success: true }
}
