'use server'

/**
 * Contactos de calle: el candidato (o quien lo acompaña) anota en segundos a
 * quién saludó, y el líder de la zona le da seguimiento. La captura llega en
 * lotes desde la cola offline del celular; cada contacto trae su id, así que
 * reenviar un lote no duplica nada.
 */

import { revalidatePath } from 'next/cache'
import { requireModule } from '@/lib/auth-helpers'
import { getTenantDb, encrypt, decrypt } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { puntoEnPoligono } from '@/lib/geometry'
import { capacidadCalle } from '@/lib/contacto-calle-db'
import { hashTelefono, elegirResponsable } from '@/lib/contacto-calle'

const ROLES_PWA = ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'ELECTOR'] as const
const TEMPERATURAS = ['FRIO', 'TIBIO', 'CALIENTE'] as const

export interface ContactoNuevo {
  id:           string // uuid generado en el celular
  fecha:        string // ISO, la hora real del saludo aunque suba después
  nombre?:      string // sin nombre = "+1 saludo"
  telefono?:    string
  temperatura?: (typeof TEMPERATURAS)[number]
  nota?:        string
  lat?:         number
  lng?:         number
}

type Resultado = { success: true; guardados: number } | { success: false; error: string }

async function sesionYDb() {
  const session = await requireModule('CORE', [...ROLES_PWA])
  return { session, tenantId: session.user.tenantId, db: getTenantDb(await getTenantConnection(session.user.tenantId)) }
}

function valido(c: ContactoNuevo): boolean {
  const fecha = Date.parse(c.fecha)
  return typeof c.id === 'string' && /^[0-9a-f-]{36}$/i.test(c.id)
    && !isNaN(fecha) && fecha <= Date.now() + 3_600_000
    && (c.nombre ?? '').length <= 120 && (c.telefono ?? '').length <= 30 && (c.nota ?? '').length <= 500
    && (c.temperatura === undefined || TEMPERATURAS.includes(c.temperatura))
    && (c.lat === undefined || (Math.abs(c.lat) <= 90 && Math.abs(c.lng ?? 999) <= 180))
}

export async function registrarContactos(lote: ContactoNuevo[]): Promise<Resultado> {
  const { session, tenantId, db } = await sesionYDb()
  const cap = await capacidadCalle(session, db)
  if (!cap) return { success: false, error: 'Tu cuenta no puede anotar contactos de calle.' }
  if (!Array.isArray(lote) || lote.length > 200 || !lote.every(valido)) {
    return { success: false, error: 'Lote de contactos inválido.' }
  }

  // Zona y responsable desde el GPS. Polígonos solo si algún contacto trae punto.
  const conPunto = lote.some((c) => c.nombre?.trim() && c.lat !== undefined)
  const [barrios, comunas] = conPunto
    ? await Promise.all([
        db.neighborhood.findMany({ select: { id: true, boundary: true, liderId: true, communeId: true } }),
        db.commune.findMany({ select: { id: true, boundary: true, liderId: true } }),
      ])
    : [[], []]
  const dentro = (b: unknown, p: [number, number]) => Array.isArray(b) && b.length > 2 && puntoEnPoligono(p, b as [number, number][])

  const data = lote.map((c) => {
    const nombre = c.nombre?.trim() || null
    const tel    = nombre ? c.telefono?.trim() || null : null
    const p: [number, number] | null = c.lat !== undefined && c.lng !== undefined ? [c.lat, c.lng] : null
    const barrio = nombre && p ? barrios.find((b) => dentro(b.boundary, p)) : undefined
    const comuna = nombre && p
      ? comunas.find((k) => (barrio ? k.id === barrio.communeId : dentro(k.boundary, p)))
      : undefined
    return {
      id: c.id, tenantId, fecha: new Date(c.fecha),
      anfitrionId: cap.anfitrionId, registradoPorId: cap.registradoPorId,
      nombre, telefono: tel ? encrypt(tel) : null, telefonoHash: hashTelefono(tel),
      temperatura: nombre ? c.temperatura ?? null : null, nota: nombre ? c.nota?.trim() || null : null,
      lat: p?.[0] ?? null, lng: p?.[1] ?? null,
      neighborhoodId: barrio?.id ?? null, communeId: comuna?.id ?? null,
      asignadoAId: nombre ? elegirResponsable({ barrioLider: barrio?.liderId ?? null, comunaLider: comuna?.liderId ?? null }) : null,
    }
  })

  const { count } = await db.contactoCalle.createMany({ data, skipDuplicates: true })
  revalidatePath('/core/estructura')
  return { success: true, guardados: count }
}

export interface MiDia { saludos: number; fichas: number; ultimos: { id: string; nombre: string; hora: string }[] }

/** Cuántos lleva hoy el anfitrión (hora de Colombia), para el contador de la pantalla. */
export async function getMiDia(): Promise<MiDia | null> {
  const { session, tenantId, db } = await sesionYDb()
  const cap = await capacidadCalle(session, db)
  if (!cap) return null
  const inicio = new Date(Math.floor((Date.now() - 5 * 3_600_000) / 86_400_000) * 86_400_000 + 5 * 3_600_000)
  const hoy = await db.contactoCalle.findMany({
    where:   { tenantId, anfitrionId: cap.anfitrionId, fecha: { gte: inicio } },
    select:  { id: true, nombre: true, fecha: true },
    orderBy: { fecha: 'desc' },
  })
  const fichas = hoy.filter((c) => c.nombre)
  return {
    saludos: hoy.length - fichas.length,
    fichas:  fichas.length,
    ultimos: fichas.slice(0, 10).map((c) => ({
      id: c.id, nombre: c.nombre!,
      hora: c.fecha.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }),
    })),
  }
}

// ── Bandeja del líder ────────────────────────────────────────────────────────

export interface ContactoPorConvertir {
  id:          string
  nombre:      string
  telefono:    string | null
  temperatura: string | null
  nota:        string | null
  fecha:       string
  estado:      'PENDIENTE' | 'INVITADO'
}

/** Contactos de calle que le tocan al líder de la sesión y aún no se registran. */
export async function misContactosPorConvertir(): Promise<ContactoPorConvertir[]> {
  const { session, tenantId, db } = await sesionYDb()
  if (!session.user.voterId) return []
  const filas = await db.contactoCalle.findMany({
    where:   { tenantId, asignadoAId: session.user.voterId, estado: { in: ['PENDIENTE', 'INVITADO'] }, nombre: { not: null } },
    orderBy: { fecha: 'desc' },
    take:    100,
  })
  return filas.map((c) => ({
    id: c.id, nombre: c.nombre!, telefono: c.telefono ? decrypt(c.telefono) : null,
    temperatura: c.temperatura, nota: c.nota, fecha: c.fecha.toISOString(),
    estado: c.estado as 'PENDIENTE' | 'INVITADO',
  }))
}

export async function marcarContacto(id: string, estado: 'INVITADO' | 'DESCARTADO'): Promise<Resultado> {
  const { session, tenantId, db } = await sesionYDb()
  if (!session.user.voterId || !['INVITADO', 'DESCARTADO'].includes(estado)) return { success: false, error: 'No permitido.' }
  const { count } = await db.contactoCalle.updateMany({
    where: { id, tenantId, asignadoAId: session.user.voterId, estado: { in: ['PENDIENTE', 'INVITADO'] } },
    data:  { estado },
  })
  revalidatePath('/core/estructura')
  return count ? { success: true, guardados: count } : { success: false, error: 'El contacto ya no está en tu bandeja.' }
}
