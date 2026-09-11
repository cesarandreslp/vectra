/**
 * API del Censo Electoral: dónde vota una cédula (fuente: Registraduría).
 *
 * Siempre en modo asíncrono. La consulta síncrona tarda hasta ~40 s con una
 * cédula que no está en caché y el gateway de AWS corta a los ~29 s con un 503,
 * así que falla justo la primera vez. El flujo:
 *   1. encolar → la API devuelve job_id y el elector queda PENDIENTE.
 *   2. la API llama a /api/webhooks/censo (firmado) con el resultado.
 *   3. si el webhook no llega (reintentos agotados, o dev en localhost, que la
 *      API no acepta como callback_url), el siguiente lote lo recoge por GET.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { waitUntil } from '@vercel/functions'
import { decrypt, type getTenantDb } from '@vectra/db'

type Db = ReturnType<typeof getTenantDb>
type Json = Record<string, unknown>

export type EstadoCenso = 'PENDIENTE' | 'ENCONTRADO' | 'NO_ENCONTRADO' | 'ERROR'

export function censoConfigurado(): boolean {
  return Boolean(process.env.CENSO_API_URL && process.env.CENSO_API_KEY)
}

async function llamarApi(ruta: string, body?: Json): Promise<Json> {
  const res = await fetch(`${process.env.CENSO_API_URL}${ruta}`, {
    method:  body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Client-Key': process.env.CENSO_API_KEY ?? '' },
    body:    body ? JSON.stringify(body) : undefined,
    signal:  AbortSignal.timeout(15_000),
  })
  return (await res.json()) as Json
}

/**
 * X-Webhook-Signature = "sha256=" + hex(HMAC_SHA256(secreto, "<timestamp>.<cuerpo crudo>")).
 * Se rechaza si el timestamp se aleja más de 300 s (evita reenvíos viejos).
 */
export function firmaValida(
  secreto: string, timestamp: string, cuerpo: string, firma: string,
  ahoraSeg = Date.now() / 1000,
): boolean {
  const ts = Number(timestamp)
  if (!timestamp || !Number.isFinite(ts) || Math.abs(ahoraSeg - ts) > 300) return false
  const esperada = Buffer.from('sha256=' + createHmac('sha256', secreto).update(`${timestamp}.${cuerpo}`).digest('hex'))
  const recibida = Buffer.from(firma)
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida)
}

/**
 * Traduce a lo que se guarda cualquiera de las tres formas en que llega un
 * resultado — GET del job, cuerpo del webhook ({ job_id, status, success, data })
 * o el 200 de idempotencia del POST ({ success, data }). null = sigue en curso.
 * data: { estado, nuip, departamento, municipio, puesto, direccion, mesa,
 *         latitud, longitud, mapa_url, mensaje }
 */
export function interpretarJob(job: Json): { estado: EstadoCenso; lugar: Json | null } | null {
  if (job.status === 'pending' || job.status === 'processing') return null
  if (job.status === 'failed' || job.success !== true || !job.data) return { estado: 'ERROR', lugar: null }

  // nuip = la cédula en claro; no se guarda (PII cifrada en reposo, Ley 1581).
  const { nuip: _nuip, ...lugar } = job.data as Json
  return { estado: lugar.estado === 'encontrado' ? 'ENCONTRADO' : 'NO_ENCONTRADO', lugar }
}

/** Idempotente: el webhook puede llegar repetido y se correlaciona por job_id. */
export async function aplicarJob(db: Db, tenantId: string, jobId: string, job: Json): Promise<void> {
  const r = interpretarJob(job)
  if (!r) return
  await db.voter.updateMany({
    where: { tenantId, censoJobId: jobId },
    data:  {
      censoEstado:       r.estado,
      censoVerificadoEn: new Date(),
      ...(r.lugar ? { censoLugar: r.lugar as object } : {}),
    },
  })
}

export async function recogerCenso(db: Db, tenantId: string, jobId: string): Promise<void> {
  try {
    await aplicarJob(db, tenantId, jobId, await llamarApi(`/v1/consulta-async/${encodeURIComponent(jobId)}`))
  } catch (err) {
    console.error(`[censo] no se pudo consultar el job ${jobId}:`, err instanceof Error ? err.message : err)
  }
}

export async function encolarCenso(db: Db, tenantId: string, voter: { id: string; cedula: string }): Promise<void> {
  try {
    const cc = decrypt(voter.cedula).replace(/\D/g, '')
    if (!/^\d{3,10}$/.test(cc)) throw new Error('la cédula no tiene el formato que acepta la API (3 a 10 dígitos)')

    // CENSO_CALLBACK_URL solo hace falta en dev: la API rechaza localhost.
    const callback = process.env.CENSO_CALLBACK_URL ?? `${process.env.NEXTAUTH_URL}/api/webhooks/censo`
    // Sin job_id propio: la API colapsa la misma cédula dentro del día (UTC).
    const r = await llamarApi('/v1/consulta-async', {
      tipo: 'registraduria', cc, callback_url: `${callback}?t=${encodeURIComponent(tenantId)}`,
    })

    // 200 = ya la había resuelto hoy; viene el resultado y no habrá webhook.
    const yaResuelto = r.success === true ? interpretarJob(r) : null
    if (yaResuelto) {
      await db.voter.update({
        where: { id: voter.id },
        data:  {
          censoEstado: yaResuelto.estado, censoJobId: null, censoVerificadoEn: new Date(),
          ...(yaResuelto.lugar ? { censoLugar: yaResuelto.lugar as object } : {}),
        },
      })
      return
    }
    if (typeof r.job_id !== 'string') throw new Error(String(r.error ?? r.message ?? 'la API no devolvió job_id'))

    await db.voter.update({ where: { id: voter.id }, data: { censoEstado: 'PENDIENTE', censoJobId: r.job_id } })
  } catch (err) {
    console.error(`[censo] no se pudo encolar el elector ${voter.id}:`, err instanceof Error ? err.message : err)
    await db.voter.update({ where: { id: voter.id }, data: { censoEstado: 'ERROR', censoVerificadoEn: new Date() } })
  }
}

// ponytail: 10 llamadas simultáneas a ciegas; la API no documenta límite de uso.
async function enTandas<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += 10) await Promise.all(items.slice(i, i + 10).map(fn))
}

/**
 * Un lote sobre el padrón: recoge por GET los PENDIENTES cuyo webhook no llegó
 * y encola los nunca verificados (o con ERROR de hace más de una hora).
 * ponytail: dos lotes simultáneos pueden encolar al mismo elector dos veces;
 * gana el último job y el webhook del otro no encuentra a nadie. Solo cuesta
 * una consulta de más.
 */
export async function procesarCensoPendientes(db: Db, tenantId: string, limite = 100) {
  if (!censoConfigurado()) return { encolados: 0, revisados: 0, restantes: 0 }

  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000)
  const [pendientes, nuevos] = await Promise.all([
    db.voter.findMany({
      where:  { tenantId, censoEstado: 'PENDIENTE', censoJobId: { not: null } },
      select: { censoJobId: true },
      take:   limite,
    }),
    db.voter.findMany({
      where:  { tenantId, OR: [{ censoEstado: null }, { censoEstado: 'ERROR', censoVerificadoEn: { lt: haceUnaHora } }] },
      select: { id: true, cedula: true },
      take:   limite,
    }),
  ])

  await enTandas(pendientes, (p) => recogerCenso(db, tenantId, p.censoJobId as string))
  await enTandas(nuevos, (v) => encolarCenso(db, tenantId, v))

  const restantes = await db.voter.count({
    where: { tenantId, OR: [{ censoEstado: null }, { censoEstado: 'PENDIENTE' }] },
  })
  return { encolados: nuevos.length, revisados: pendientes.length, restantes }
}

/** Para las altas de electores: verifica en segundo plano sin demorar la respuesta. */
export function censoEnSegundoPlano(db: Db, tenantId: string): void {
  waitUntil(
    procesarCensoPendientes(db, tenantId).catch((err) =>
      console.error('[censo] lote en segundo plano falló:', err instanceof Error ? err.message : err),
    ),
  )
}
