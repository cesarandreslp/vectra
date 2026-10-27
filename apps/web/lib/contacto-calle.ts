/**
 * Contactos de calle del candidato (ContactoCalle): las reglas que no tocan la
 * base, para poder probarlas solas. Ver pwa/calle.
 */

import { createHash } from 'crypto'

/** Solo dígitos y los últimos 10: "+57 300 123 4567" y "3001234567" son el mismo celular. */
export function normalizarTelefono(t: string): string {
  return t.replace(/\D/g, '').slice(-10)
}

/** Hash para cruzar un contacto con el elector que se registra, sin descifrar nada. null si no hay celular válido. */
export function hashTelefono(t: string | null | undefined): string | null {
  const n = t ? normalizarTelefono(t) : ''
  return n.length >= 7 ? createHash('sha256').update(n).digest('hex') : null
}

/** Quién le hace seguimiento: el líder del barrio; si no hay, el de la comuna; si no, nadie (lo ve el admin). */
export function elegirResponsable(z: { barrioLider: string | null; comunaLider: string | null }): string | null {
  return z.barrioLider ?? z.comunaLider ?? null
}

export interface FilaResumen {
  fecha:  Date
  nombre: string | null
  estado: 'PENDIENTE' | 'INVITADO' | 'CONVERTIDO' | 'DESCARTADO'
}

export interface ResumenContactos {
  hoy:              number
  semana:           number // últimos 7 días, hoy incluido
  saludos:          number // sin datos: solo cuentan
  fichas:           number // con nombre: se les puede dar seguimiento
  convertidos:      number
  sinSeguimiento:   number // fichas PENDIENTE de hace más de 3 días
}

const DIA = 86_400_000

/** `hoy` en hora de Colombia (UTC-5) para que "hoy" no cambie a las 7 p. m. */
export function resumenContactos(filas: FilaResumen[], ahora: Date): ResumenContactos {
  const inicioHoy = Math.floor((ahora.getTime() - 5 * 3_600_000) / DIA) * DIA + 5 * 3_600_000
  const r: ResumenContactos = { hoy: 0, semana: 0, saludos: 0, fichas: 0, convertidos: 0, sinSeguimiento: 0 }
  for (const f of filas) {
    const t = f.fecha.getTime()
    if (t >= inicioHoy) r.hoy++
    if (t >= inicioHoy - 6 * DIA) r.semana++
    if (!f.nombre) { r.saludos++; continue }
    r.fichas++
    if (f.estado === 'CONVERTIDO') r.convertidos++
    if (f.estado === 'PENDIENTE' && ahora.getTime() - t > 3 * DIA) r.sinSeguimiento++
  }
  return r
}
