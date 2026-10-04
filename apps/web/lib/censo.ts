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

export type EstadoCenso = 'PENDIENTE' | 'ENCONTRADO' | 'NOVEDAD' | 'NO_ENCONTRADO' | 'ERROR'

export function censoConfigurado(): boolean {
  return Boolean(process.env.CENSO_API_URL && process.env.CENSO_API_KEY)
}

async function llamarApi(ruta: string, body?: Json): Promise<Json> {
  const res = await fetch(`${process.env.CENSO_API_URL}${ruta}`, {
    method:  body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Client-Key': process.env.CENSO_API_KEY ?? '' },
    body:    body ? JSON.stringify(body) : undefined,
    // La API pide un timeout de cliente de al menos 30 s: la consulta síncrona
    // tarda ~25 s antes de contestar 202. Con 15 s se abortaba sola y toda
    // consulta lenta quedaba marcada como ERROR.
    signal:  AbortSignal.timeout(40_000),
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
  // estado de la API: encontrado | novedad | no_encontrado
  const estado: EstadoCenso =
    lugar.estado === 'encontrado' ? 'ENCONTRADO'
    : lugar.estado === 'novedad'  ? 'NOVEDAD'
    : 'NO_ENCONTRADO'
  return { estado, lugar }
}

/** Guarda lo que devolvió la API para un elector. jobId null = ya no hay nada que esperar. */
async function guardarResultado(
  db: Db, voterId: string, r: { estado: EstadoCenso; lugar: Json | null },
): Promise<void> {
  const v = await db.voter.update({
    where: { id: voterId },
    data:  {
      censoEstado: r.estado, censoJobId: null, censoVerificadoEn: new Date(),
      ...(r.lugar ? { censoLugar: r.lugar as object } : {}),
    },
    select: { tenantId: true },
  })
  await asignarMesasDelCenso(db, v.tenantId)
}

/** "SEDE GUADALAJARA" y "Sede Guadalajara" son el mismo puesto; "BUGA" está en "Guadalajara de Buga". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

/**
 * Asigna puesto y mesa a los electores encontrados en el censo que todavía no
 * tienen mesa, para que cuenten en la vista "por puesto" del mapa y en la
 * jurisdicción. El puesto se cruza por nombre dentro de su municipio; si la
 * campaña no lo tiene cargado (o la mesa), se crea con los datos del censo.
 * Nunca pisa una mesa ya asignada a mano. Idempotente.
 */
export async function asignarMesasDelCenso(db: Db, tenantId: string): Promise<number> {
  const electores = await db.voter.findMany({
    where:  { tenantId, censoEstado: 'ENCONTRADO', OR: [{ votingTableId: null }, { votingTable: { station: { lat: null } } }] },
    select: { id: true, censoLugar: true, votingTableId: true },
  })
  if (electores.length === 0) return 0

  const puestos = await db.votingStation.findMany({
    select: { id: true, name: true, lat: true, municipality: { select: { name: true } }, tables: { select: { id: true, number: true } } },
  })
  let asignados = 0

  for (const e of electores) {
    const l = e.censoLugar as { puesto?: string; mesa?: string; municipio?: string; departamento?: string; direccion?: string; latitud?: number; longitud?: number } | null
    const mesa = Number(l?.mesa)
    if (!l?.puesto || !l.municipio || !Number.isInteger(mesa) || mesa <= 0) continue
    const muni = normalizar(l.municipio)

    let puesto = puestos.find((p) => normalizar(p.name) === normalizar(l.puesto!) && normalizar(p.municipality.name).includes(muni))
    if (!puesto) {
      // El municipio del censo viene abreviado ("BUGA"); el departamento desempata.
      const candidatos = await db.municipality.findMany({
        where:  { department: { name: { contains: l.departamento ?? '', mode: 'insensitive' } } },
        select: { id: true, name: true },
      })
      const municipio = candidatos.filter((m) => normalizar(m.name).includes(muni))
      if (municipio.length !== 1) continue // ambiguo o desconocido: mejor sin mesa que en la equivocada
      const creado = await db.votingStation.create({
        data: {
          name: l.puesto, address: l.direccion ?? '', municipalityId: municipio[0].id,
          lat: Number.isFinite(l.latitud) ? l.latitud : null, lng: Number.isFinite(l.longitud) ? l.longitud : null,
        },
        select: { id: true, name: true, lat: true, municipality: { select: { name: true } } },
      })
      puesto = { ...creado, tables: [] }
      puestos.push(puesto)
    } else if (puesto.lat === null && Number.isFinite(l.latitud) && Number.isFinite(l.longitud)) {
      // Puesto cargado sin ubicar: la coordenada oficial del censo lo pone en el mapa.
      await db.votingStation.update({ where: { id: puesto.id }, data: { lat: l.latitud, lng: l.longitud } })
      puesto.lat = l.latitud!
    }

    if (e.votingTableId) continue // ya tenía mesa: solo se venía a ubicar su puesto

    let mesaId = puesto.tables.find((t) => t.number === mesa)?.id
    if (!mesaId) {
      const t = await db.votingTable.upsert({
        where:  { stationId_number: { stationId: puesto.id, number: mesa } },
        update: {},
        create: { stationId: puesto.id, number: mesa },
        select: { id: true, number: true },
      })
      puesto.tables.push(t)
      mesaId = t.id
    }

    await db.voter.update({ where: { id: e.id }, data: { votingTableId: mesaId } })
    asignados++
  }
  return asignados
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
  await asignarMesasDelCenso(db, tenantId)
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
    if (yaResuelto) return guardarResultado(db, voter.id, yaResuelto)
    if (typeof r.job_id !== 'string') throw new Error(String(r.error ?? r.message ?? 'la API no devolvió job_id'))

    await db.voter.update({ where: { id: voter.id }, data: { censoEstado: 'PENDIENTE', censoJobId: r.job_id } })
  } catch (err) {
    console.error(`[censo] no se pudo encolar el elector ${voter.id}:`, err instanceof Error ? err.message : err)
    await db.voter.update({ where: { id: voter.id }, data: { censoEstado: 'ERROR', censoVerificadoEn: new Date() } })
  }
}

/**
 * Consulta de UN elector, para el botón de la ficha: va por la ruta síncrona,
 * que normalmente contesta el resultado en la misma llamada (200). Si la API se
 * demora devuelve 202 con job_id y el elector queda PENDIENTE, igual que en el
 * lote: lo recoge el próximo "Revisar resultado" o el webhook.
 */
export async function consultarCensoAhora(db: Db, voter: { id: string; cedula: string }): Promise<void> {
  try {
    const cc = decrypt(voter.cedula).replace(/\D/g, '')
    if (!/^\d{3,10}$/.test(cc)) throw new Error('la cédula no tiene el formato que acepta la API (3 a 10 dígitos)')

    const r = await llamarApi('/v1/consulta', { tipo: 'registraduria', cc })

    const resultado = interpretarJob(r) // null = 202, quedó encolada
    if (resultado) return guardarResultado(db, voter.id, resultado)

    if (typeof r.job_id !== 'string') throw new Error(String(r.error ?? r.message ?? 'respuesta inesperada de la API'))
    await db.voter.update({ where: { id: voter.id }, data: { censoEstado: 'PENDIENTE', censoJobId: r.job_id } })
  } catch (err) {
    console.error(`[censo] falló la consulta del elector ${voter.id}:`, err instanceof Error ? err.message : err)
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
  await asignarMesasDelCenso(db, tenantId) // también los que ya estaban verificados antes de existir esto

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
