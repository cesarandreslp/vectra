'use server'

/**
 * Server Actions del módulo CORE.
 * Todas las acciones:
 *   - Verifican autenticación y rol con requireAuth / requireModule
 *   - Obtienen la DB del tenant via getTenantConnection()
 *   - Nunca retornan cédula ni connectionString al cliente
 */

import { requireAuth, requireModule, requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection }        from '@/lib/tenant'
import { calcularCedulaHash }         from '@/lib/cedula-hash'
import { getTenantDb, encrypt, decrypt, Prisma } from '@vectra/db'
import { geocodeAddress }             from '@/lib/geocode'
import { resolverBarrios }            from '@/lib/barrios'
import { puntoEnPoligono }            from '@/lib/geometry'
import { coloresPorZona }             from '@/lib/colores-comuna'
import { crearQrPropio }              from '@/lib/qr'
import { calcularIndiceCompromiso }   from '@/lib/compromiso'
import { titulosDe, type TituloLider } from '@/lib/lideres'
import { chatGroq }                   from '@vectra/ai'
import { getTenantAiKeys }            from '@/lib/tenant-ai'
import { revalidatePath }             from 'next/cache'
import type { Cargo }                 from './configuracion/actions'

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type CommitmentStatus =
  | 'SIN_CONTACTAR'
  | 'CONTACTADO'
  | 'SIMPATIZANTE'
  | 'COMPROMETIDO'
  | 'VOTO_SEGURO'

export interface CreateLeaderInput {
  cedula:         string
  name:           string
  apodo?:         string
  phone?:         string
  zone?:          string
  parentLeaderId?: string
  targetVotes:    number
}

export interface LeaderFilters {
  id?:             string  // buscar un líder puntual por id, aunque aún no tenga followers
  zone?:           string
  status?:         string
  parentLeaderId?: string
  search?:         string  // nombre (contiene) o cédula exacta
}

export interface VoterOption {
  id:   string
  name: string
  zone: string | null
}

export interface LeaderSummary {
  id:             string
  name:           string
  zone:           string | null
  status:         string
  targetVotes:    number
  totalElectores: number
  comprometidos:  number
  isCandidate:    boolean
  tieneAgenda:    boolean
  pctAvance:      number // 0-100
  parentLeaderId: string | null
  /** Títulos ganados (reclutamiento directo y/o red construida). Ver lib/lideres.ts. */
  titulos:        TituloLider[]
}

export interface CreateVoterInput {
  cedula:           string
  name:             string
  apodo?:           string
  phone?:           string
  address?:         string
  leaderId?:        string
  votingTableId?:   string
  commitmentStatus?: CommitmentStatus
}

export interface VoterFilters {
  leaderId?:         string
  commitmentStatus?: CommitmentStatus
  zone?:             string
  search?:           string
}

export interface VoterSummary {
  id:               string
  name:             string
  leaderId:         string | null
  votingTableId:    string | null
  commitmentStatus: CommitmentStatus
  lastContact:      Date | null
  notes:            string | null
  // NUNCA incluir cedula ni phone en el retorno (PII)
}

export interface ImportVoterRow {
  cedula:           string
  name:             string
  phone?:           string
  leaderName?:      string  // se resuelve a leaderId por nombre
  commitmentStatus?: CommitmentStatus
}

export interface ImportResult {
  created: number
  skipped: number
  errors:  string[]
}

// ── Helpers internos ──────────────────────────────────────────────────────────

/** Retorna un cliente Prisma para la DB del tenant autenticado */
async function obtenerDbTenant(tenantId: string) {
  const connectionString = await getTenantConnection(tenantId)
  return getTenantDb(connectionString)
}

/**
 * Punto ÚNICO donde se decide qué títulos tiene cada elector. Todo lo demás
 * (panel, ranking, Analytics, agenda de la PWA) deriva de acá — antes la regla
 * estaba repetida en SQL crudo en Analytics y se habría desincronizado sola.
 *
 * Devuelve solo a quienes ganaron al menos un título.
 */
export async function titulosPorLider(
  tenantId: string, db: ReturnType<typeof getTenantDb>,
): Promise<Map<string, TituloLider[]>> {
  const todos = await db.voter.findMany({
    where:  { tenantId },
    select: { id: true, leaderId: true },
  })

  const hijos = new Map<string, string[]>()
  for (const v of todos) {
    if (!v.leaderId) continue
    const lista = hijos.get(v.leaderId) ?? []
    lista.push(v.id)
    hijos.set(v.leaderId, lista)
  }

  // Tamaño de la red completa debajo de cada quien. `enCurso` corta un ciclo
  // (A→B→A) en vez de desbordar la pila: el árbol lo arman humanos desde la UI.
  const cache   = new Map<string, number>()
  const enCurso = new Set<string>()
  function red(id: string): number {
    const memo = cache.get(id)
    if (memo !== undefined) return memo
    if (enCurso.has(id)) return 0
    enCurso.add(id)

    const propios = hijos.get(id) ?? []
    let total = propios.length
    for (const h of propios) total += red(h)

    enCurso.delete(id)
    cache.set(id, total)
    return total
  }

  const titulos = new Map<string, TituloLider[]>()
  for (const v of todos) {
    const ganados = titulosDe(hijos.get(v.id)?.length ?? 0, red(v.id))
    if (ganados.length > 0) titulos.set(v.id, ganados)
  }
  return titulos
}

/** Ids de electores que califican como "líder" — los que tienen algún título. */
export async function idsLideres(
  tenantId: string, db: ReturnType<typeof getTenantDb>,
): Promise<Set<string>> {
  return new Set((await titulosPorLider(tenantId, db)).keys())
}

/**
 * IDs de un elector y todo su sub-árbol (directos + todos los niveles),
 * incluyéndolo a él. Usado para acotar qué ve un usuario con rol LIDER —
 * "su gente", no toda la campaña.
 */
export async function idsSubarbol(
  raizId: string, tenantId: string, db: ReturnType<typeof getTenantDb>,
): Promise<Set<string>> {
  const todos = await db.voter.findMany({ where: { tenantId }, select: { id: true, leaderId: true } })
  const hijosPorLider = new Map<string, string[]>()
  for (const v of todos) {
    if (!v.leaderId) continue
    const lista = hijosPorLider.get(v.leaderId) ?? []
    lista.push(v.id)
    hijosPorLider.set(v.leaderId, lista)
  }

  const ids  = new Set<string>([raizId])
  const pila = [raizId]
  while (pila.length > 0) {
    const actual = pila.pop()!
    for (const hijoId of hijosPorLider.get(actual) ?? []) {
      if (!ids.has(hijoId)) { ids.add(hijoId); pila.push(hijoId) }
    }
  }
  return ids
}

/**
 * Profundidad de cada elector del sub-árbol respecto a la raíz (0 = la raíz
 * misma, 1 = directos, 2 = "nietos", etc.). Usado para que "mis electores"
 * distinga quién es directo de quién viene de más abajo en la cadena.
 */
export async function profundidadSubarbol(
  raizId: string, tenantId: string, db: ReturnType<typeof getTenantDb>,
): Promise<Map<string, number>> {
  const todos = await db.voter.findMany({ where: { tenantId }, select: { id: true, leaderId: true } })
  const hijosPorLider = new Map<string, string[]>()
  for (const v of todos) {
    if (!v.leaderId) continue
    const lista = hijosPorLider.get(v.leaderId) ?? []
    lista.push(v.id)
    hijosPorLider.set(v.leaderId, lista)
  }

  const profundidad = new Map<string, number>([[raizId, 0]])
  const cola = [raizId]
  while (cola.length > 0) {
    const actual = cola.shift()!
    for (const hijoId of hijosPorLider.get(actual) ?? []) {
      if (!profundidad.has(hijoId)) {
        profundidad.set(hijoId, profundidad.get(actual)! + 1)
        cola.push(hijoId)
      }
    }
  }
  return profundidad
}

export interface NodoOrganizacion {
  id:       string
  name:     string
  zone:     string | null
  directos: number
  /** Red completa debajo suyo, a cualquier profundidad. */
  red:      number
  titulos:  TituloLider[]
  children: NodoOrganizacion[]
}

/**
 * Árbol de organización de un elector (él como raíz + toda la cadena de
 * gente que tiene su propia gente debajo), sin importar si cada uno
 * individualmente llega al umbral de líder — antes esta vista solo incluía
 * a quienes YA calificaban como líder (listLeaders), así que un conector
 * con <10 directos (ej. alguien con 4 electores, uno de los cuales sí es
 * líder) desaparecía del árbol y "cortaba" la cadena visualmente, aunque
 * el dato seguía intacto. Los electores sin gente propia no aparecen como
 * nodos (ya están en la tabla plana de "Electores" de la ficha) — solo la
 * raíz y los conectores, recursivamente.
 */
export async function getArbolOrganizacion(raizId: string): Promise<NodoOrganizacion | null> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], 'CORE_LIDERES')
  const db      = await obtenerDbTenant(session.user.tenantId)

  if (session.user.role === 'LIDER') {
    if (!session.user.voterId) return null
    const permitidos = await idsSubarbol(session.user.voterId, session.user.tenantId, db)
    if (!permitidos.has(raizId)) return null
  }

  const todos = await db.voter.findMany({
    where:  { tenantId: session.user.tenantId },
    select: { id: true, name: true, zone: true, leaderId: true },
  })
  const raiz = todos.find((v) => v.id === raizId)
  if (!raiz) return null

  const hijosPorLider = new Map<string, typeof todos>()
  for (const v of todos) {
    if (!v.leaderId) continue
    const lista = hijosPorLider.get(v.leaderId) ?? []
    lista.push(v)
    hijosPorLider.set(v.leaderId, lista)
  }

  // Mismo criterio de título que el panel y el ranking: si acá se calculara
  // solo con los directos, María Eugenia saldría sin distintivo en el árbol y
  // con "Constructor de red" en el panel, contradiciéndose.
  const cacheRed = new Map<string, number>()
  function red(id: string): number {
    const memo = cacheRed.get(id)
    if (memo !== undefined) return memo
    cacheRed.set(id, 0) // corta ciclos antes de recursar
    const propios = hijosPorLider.get(id) ?? []
    let total = propios.length
    for (const h of propios) total += red(h.id)
    cacheRed.set(id, total)
    return total
  }

  function nodo(v: { id: string; name: string; zone: string | null }): NodoOrganizacion {
    const directos = hijosPorLider.get(v.id)?.length ?? 0
    const total    = red(v.id)
    return {
      id: v.id, name: v.name, zone: v.zone,
      directos, red: total,
      titulos:  titulosDe(directos, total),
      children: construirHijos(v.id),
    }
  }

  function construirHijos(id: string): NodoOrganizacion[] {
    return (hijosPorLider.get(id) ?? [])
      .filter((h) => (hijosPorLider.get(h.id)?.length ?? 0) > 0)
      .map(nodo)
  }

  return nodo(raiz)
}

// ── Acciones de líderes ───────────────────────────────────────────────────────
// No existe "crear líder": todos se crean como electores (createVoter, más
// abajo). "Líder" es una etiqueta que aparece sola al ganar algún título, por
// reclutamiento directo o por red construida (ver titulosPorLider) — lo único
// que se edita aquí es lo que solo tiene sentido una vez alguien actúa como
// tal (zona, meta).

/**
 * Actualiza datos de un líder existente.
 * Solo puede modificar líderes del mismo tenant.
 */
export async function updateLeader(
  id: string,
  data: Partial<CreateLeaderInput>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_LIDERES', 'edit')
    const db      = await obtenerDbTenant(session.user.tenantId)

    // Verificar que el líder pertenece al tenant
    const existente = await db.voter.findFirst({
      where: { id, tenantId: session.user.tenantId },
    })
    if (!existente) return { success: false, error: 'Líder no encontrado.' }

    // Validar nuevo parentLeaderId si se provee
    if (data.parentLeaderId) {
      const padre = await db.voter.findFirst({
        where: { id: data.parentLeaderId, tenantId: session.user.tenantId },
      })
      if (!padre) return { success: false, error: 'El líder superior no existe en esta campaña.' }
      // Evitar ciclos: no asignar como padre a un hijo propio
      if (data.parentLeaderId === id) return { success: false, error: 'Un líder no puede ser su propio superior.' }
    }

    const phoneCifrado = data.phone ? encrypt(data.phone) : undefined

    await db.voter.update({
      where: { id },
      data: {
        ...(data.name           !== undefined && { name:        data.name }),
        ...(data.apodo          !== undefined && { apodo:       data.apodo.trim() || null }),
        ...(phoneCifrado        !== undefined && { phone:       phoneCifrado }),
        ...(data.zone           !== undefined && { zone:        data.zone }),
        ...(data.parentLeaderId !== undefined && { leaderId:    data.parentLeaderId }),
        ...(data.targetVotes    !== undefined && { targetVotes: data.targetVotes }),
      },
    })

    revalidatePath('/core/lideres')
    return { success: true }

  } catch (err) {
    console.error('[updateLeader]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al actualizar el líder.' }
  }
}

/**
 * Marca (o desmarca) a un Voter como el candidato de la campaña — el líder
 * natural de la raíz, que no debe aparecer en el panel de líderes ni en el
 * ranking. A lo sumo un candidato por tenant: marcar uno nuevo desmarca al
 * anterior automáticamente.
 */
export async function setCandidato(id: string, isCandidate: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA'], 'CORE_LIDERES', 'edit')
    const db      = await obtenerDbTenant(session.user.tenantId)

    const existente = await db.voter.findFirst({ where: { id, tenantId: session.user.tenantId } })
    if (!existente) return { success: false, error: 'Elector no encontrado.' }

    if (isCandidate) {
      await db.voter.updateMany({
        where: { tenantId: session.user.tenantId, isCandidate: true },
        data:  { isCandidate: false },
      })
    }
    await db.voter.update({ where: { id }, data: { isCandidate } })

    revalidatePath('/core/lideres')
    revalidatePath('/core')
    return { success: true }

  } catch (err) {
    console.error('[setCandidato]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al actualizar el candidato.' }
  }
}

/**
 * Marca o quita a un elector como "jefe de debate" — con agenda propia
 * reservable por otros electores, igual que el candidato (que siempre la
 * tiene, sin necesidad de este flag). A diferencia del candidato, puede
 * haber varios a la vez.
 */
export async function setTieneAgenda(id: string, tieneAgenda: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA'], 'CORE_LIDERES', 'edit')
    const db      = await obtenerDbTenant(session.user.tenantId)

    const existente = await db.voter.findFirst({ where: { id, tenantId: session.user.tenantId } })
    if (!existente) return { success: false, error: 'Elector no encontrado.' }

    await db.voter.update({ where: { id }, data: { tieneAgenda } })

    revalidatePath('/core/lideres')
    revalidatePath('/core/electores')
    return { success: true }

  } catch (err) {
    console.error('[setTieneAgenda]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al actualizar el jefe de debate.' }
  }
}

/**
 * Lista líderes (Voters con al menos un título — ver titulosPorLider) con
 * métricas de avance. Los LIDER solo ven sus propios datos.
 */
export async function listLeaders(filters?: LeaderFilters): Promise<LeaderSummary[]> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], 'CORE_LIDERES')
  const db      = await obtenerDbTenant(session.user.tenantId)

  // Los LIDER solo ven a su propio sub-árbol (ellos + todos sus descendientes),
  // no toda la campaña. Si su User no está vinculado a un Voter, no ve nada
  // (falla cerrado) en vez de caer de vuelta a ver toda la campaña.
  const idsPermitidos = session.user.role === 'LIDER'
    ? (session.user.voterId ? await idsSubarbol(session.user.voterId, session.user.tenantId, db) : new Set<string>())
    : null

  const titulos = await titulosPorLider(session.user.tenantId, db)

  const condiciones: any[] = [{ tenantId: session.user.tenantId }]
  // Buscar por id puntual (ej. la ficha de un líder recién creado, sin
  // followers todavía) NO exige "es líder"; listar/rankear sí lo exige.
  // El candidato es el líder natural de la raíz, pero no debe aparecer en el
  // panel — sigue siendo visible al entrar directo a su ficha por id.
  condiciones.push(
    filters?.id
      ? { id: filters.id }
      : { id: { in: [...titulos.keys()] }, isCandidate: false },
  )
  if (idsPermitidos) condiciones.push({ id: { in: [...idsPermitidos] } })
  if (filters?.zone)           condiciones.push({ zone: filters.zone })
  if (filters?.status)         condiciones.push({ status: filters.status as any })
  if (filters?.parentLeaderId) condiciones.push({ leaderId: filters.parentLeaderId })
  if (filters?.search) {
    condiciones.push({
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { cedulaHash: calcularCedulaHash(filters.search) },
      ],
    })
  }

  const lideres = await db.voter.findMany({
    where: { AND: condiciones },
    include: {
      // "Electores" del líder = followers que NO son a su vez líderes (sin followers
      // propios). Un sub-líder no cuenta como elector hacia la meta de votos del padre —
      // igual que antes, cuando Leader.voters solo incluía Voter, nunca otro Leader.
      followers: {
        where:  { followers: { none: {} } },
        select: { commitmentStatus: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return lideres.map((l) => {
    const comprometidos = l.followers.filter(
      (v) => v.commitmentStatus === 'COMPROMETIDO' || v.commitmentStatus === 'VOTO_SEGURO',
    ).length

    return {
      id:             l.id,
      name:           l.name,
      zone:           l.zone,
      status:         l.status,
      targetVotes:    l.targetVotes,
      totalElectores: l.followers.length,
      comprometidos,
      isCandidate:    l.isCandidate,
      tieneAgenda:    l.tieneAgenda,
      pctAvance:      l.targetVotes > 0
        ? Math.round((comprometidos / l.targetVotes) * 100)
        : 0,
      parentLeaderId: l.leaderId,
      titulos:        titulos.get(l.id) ?? [],
    }
  })
}

/**
 * Lista TODOS los electores del tenant como candidatos a "líder superior"
 * o "líder asignado" en los formularios. A diferencia de listLeaders(), no
 * exige tener followers — cualquier elector puede convertirse en líder en
 * el momento en que se le asigna el primer follower.
 */
export async function listVoterOptions(): Promise<VoterOption[]> {
  // También la usa Territorio para elegir líder de comuna/barrio, así que un
  // PERSONALIZADO con esa pantalla alcanza aunque no tenga la de electores.
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], ['CORE_ELECTORES', 'CORE_TERRITORIO'])
  const db      = await obtenerDbTenant(session.user.tenantId)

  return db.voter.findMany({
    where:   { tenantId: session.user.tenantId },
    select:  { id: true, name: true, zone: true },
    orderBy: { name: 'asc' },
  })
}

// ── Acciones de electores ─────────────────────────────────────────────────────

/**
 * Crea un nuevo elector.
 * La cédula se cifra con AES-256-GCM antes de guardar.
 * NUNCA se retorna la cédula en ninguna respuesta.
 */
export async function createVoter(
  data: CreateVoterInput,
): Promise<{ success: true; voterId: string } | { success: false; error: string }> {
  try {
    const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_ELECTORES', 'edit')
    const db      = await obtenerDbTenant(session.user.tenantId)

    // Validar leaderId si se provee
    if (data.leaderId) {
      const lider = await db.voter.findFirst({
        where: { id: data.leaderId, tenantId: session.user.tenantId },
      })
      if (!lider) return { success: false, error: 'El líder no existe en esta campaña.' }
    }

    // Validar votingTableId si se provee
    if (data.votingTableId) {
      const mesa = await db.votingTable.findUnique({ where: { id: data.votingTableId } })
      if (!mesa) return { success: false, error: 'La mesa de votación no existe.' }
    }

    // Cifrar campos PII y calcular hash de cédula para deduplicación
    const cedulaNorm    = data.cedula.trim()
    const cedulaHash    = calcularCedulaHash(cedulaNorm)
    const cedulaCifrada = encrypt(cedulaNorm)
    const phoneCifrado  = data.phone ? encrypt(data.phone) : undefined

    // Verificar duplicado antes de crear (usa cedulaHash, nunca la cédula cifrada)
    const existente = await db.voter.findFirst({
      where: { tenantId: session.user.tenantId, cedulaHash },
      select: { id: true, leaderId: true },
    })
    if (existente) {
      if (existente.leaderId === data.leaderId) {
        return { success: false, error: 'Ya existe un elector con esa cédula asignado a este líder.' }
      }
      return { success: false, error: 'Ya existe un elector con esa cédula en esta campaña.' }
    }

    const elector = await db.voter.create({
      data: {
        tenantId:         session.user.tenantId,
        cedula:           cedulaCifrada,
        cedulaHash,
        name:             data.name,
        apodo:            data.apodo?.trim() || undefined,
        phone:            phoneCifrado,
        address:          data.address?.trim() || undefined,
        leaderId:         data.leaderId,
        votingTableId:    data.votingTableId,
        commitmentStatus: data.commitmentStatus ?? 'SIN_CONTACTAR',
      },
    })
    await crearQrPropio(elector.id, session.user.tenantId, db)

    revalidatePath('/core/electores')
    return { success: true, voterId: elector.id }

  } catch (err: any) {
    // Error de unicidad: cédula duplicada en el tenant
    if (err?.code === 'P2002') {
      return { success: false, error: 'Ya existe un elector con esa cédula en esta campaña.' }
    }
    console.error('[createVoter]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al crear el elector.' }
  }
}

/**
 * Actualiza el estado de compromiso de un elector.
 * Cualquier rol puede actualizar, pero solo sus propios electores (los LIDER).
 * Registra lastContact automáticamente al cambiar el estado.
 */
export async function updateVoterCommitment(
  voterId: string,
  status:  CommitmentStatus,
  notes?:  string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], 'CORE_ELECTORES', 'edit')
    const db      = await obtenerDbTenant(session.user.tenantId)

    const elector = await db.voter.findFirst({
      where: { id: voterId, tenantId: session.user.tenantId },
    })
    if (!elector) return { success: false, error: 'Elector no encontrado.' }

    // Los LIDER solo pueden actualizar electores de su propio sub-árbol.
    if (session.user.role === 'LIDER') {
      if (!session.user.voterId) return { success: false, error: 'Tu usuario no está vinculado a un elector.' }
      const permitidos = await idsSubarbol(session.user.voterId, session.user.tenantId, db)
      if (!permitidos.has(voterId)) return { success: false, error: 'No tienes acceso a este elector.' }
    }

    await db.voter.update({
      where: { id: voterId },
      data: {
        commitmentStatus: status,
        lastContact:      new Date(),
        ...(notes !== undefined && { notes }),
      },
    })

    revalidatePath('/core/electores')
    return { success: true }

  } catch (err) {
    console.error('[updateVoterCommitment]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al actualizar el estado de compromiso.' }
  }
}

// ── Veredicto IA de compromiso (elector) ──────────────────────────────────────
// Mismo patrón que generarAnalisisLider() en analytics/actions.ts, pero a
// nivel elector: evalúa encuestas + reuniones + masificación en vez de
// avance de meta + recencia de contacto.

export interface CompromisoAnalysisResult {
  id:                string
  perfilTipo:        string
  indiceCompromiso:  number
  veredicto:         string
  planAccion:        { accion: string; tiempo: string; responsable: string }[] | null
  senalesDetectadas: { señal: string; peso: 'ALTO' | 'MEDIO' | 'BAJO' }[]
  justificacion:     string
  generadoEn:        string
}

const SYSTEM_PROMPT_COMPROMISO = `Eres un analista de comportamiento político especializado en campañas electorales colombianas. Evalúa el nivel de compromiso de este elector de base con la campaña, a partir de su participación en tres actividades medibles: encuestas respondidas, asistencia a reuniones convocadas por su líder, y cuánta gente registró bajo su propio link/QR (masificación).

Entrega tu análisis en este formato JSON exacto:
{
  "perfilTipo": string (Activista | Participativo | Ocasional | Desconectado),
  "indiceCompromiso": number (0-100),
  "veredicto": "COMPROMETIDO" | "EN_SEGUIMIENTO" | "EN_RIESGO",
  "senalesDetectadas": [{ "señal": string, "peso": "ALTO"|"MEDIO"|"BAJO" }],
  "planAccion": [{ "accion": string, "tiempo": string, "responsable": string }] | null,
  "justificacion": string
}

Si el veredicto es COMPROMETIDO, planAccion puede ser null (ya está aportando, no hace falta un plan). Si es EN_SEGUIMIENTO o EN_RIESGO, planAccion debe sugerir 1 a 3 acciones concretas para reactivarlo.
Responde SOLO con el JSON, sin texto adicional ni markdown.`

/**
 * Devuelve el veredicto IA de compromiso ya cacheado (< 24h) sin llamar a la
 * IA — para precargar la ficha del elector al abrirla sin gastar una llamada
 * si ya hay uno reciente. null = no hay ninguno todavía (hay que generarlo).
 */
export async function getAnalisisCompromisoCacheado(voterId: string): Promise<CompromisoAnalysisResult | null> {
  const session = await requireModule('CORE')
  const db      = await obtenerDbTenant(session.user.tenantId)

  if (session.user.role === 'LIDER' || session.user.role === 'ELECTOR') {
    if (!session.user.voterId) return null
    const permitidos = await idsSubarbol(session.user.voterId, session.user.tenantId, db)
    if (!permitidos.has(voterId)) return null
  }

  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const reciente = await db.compromisoAnalysis.findFirst({
    where:   { tenantId: session.user.tenantId, voterId, generadoEn: { gte: hace24h } },
    orderBy: { generadoEn: 'desc' },
  })
  return reciente ? formatCompromisoAnalysis(reciente) : null
}

/**
 * Genera (o reutiliza uno reciente, < 24h) el veredicto IA de compromiso de
 * un elector. Cualquier rol con acceso a ese elector puede pedirlo — LIDER/
 * ELECTOR solo dentro de su propio sub-árbol, igual que updateVoterCommitment.
 */
export async function generarAnalisisCompromiso(voterId: string): Promise<CompromisoAnalysisResult> {
  const session = await requireModule('CORE')
  const db      = await obtenerDbTenant(session.user.tenantId)

  if (session.user.role === 'LIDER' || session.user.role === 'ELECTOR') {
    if (!session.user.voterId) throw new Error('Tu usuario no está vinculado a un elector.')
    const permitidos = await idsSubarbol(session.user.voterId, session.user.tenantId, db)
    if (!permitidos.has(voterId)) throw new Error('No tienes acceso a este elector.')
  }

  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const reciente = await db.compromisoAnalysis.findFirst({
    where:   { tenantId: session.user.tenantId, voterId, generadoEn: { gte: hace24h } },
    orderBy: { generadoEn: 'desc' },
  })
  if (reciente) return formatCompromisoAnalysis(reciente)

  const elector = await db.voter.findFirstOrThrow({
    where:  { id: voterId, tenantId: session.user.tenantId },
    select: { name: true, apodo: true, commitmentStatus: true, lastContact: true, createdAt: true },
  })

  // Mismas señales que lib/compromiso.ts — se recalculan aquí para pasarlas
  // como contexto crudo a la IA (no solo el score ya reducido a 0-100).
  const campania = await db.surveyCampaign.findFirst({
    where:   { tenantId: session.user.tenantId, isActive: true, isSurveyEnabled: true },
    include: { cargos: { include: { preguntas: { select: { id: true } } } } },
  })
  const preguntaIdsActivas = campania?.cargos.flatMap((c) => c.preguntas.map((p) => p.id)) ?? []

  const [encuestasRespondidas, reunionesAsistidas, personasCaptadas] = await Promise.all([
    preguntaIdsActivas.length > 0
      ? db.surveyResponse.count({ where: { voterId, surveyPreguntaId: { in: preguntaIdsActivas } } })
      : Promise.resolve(0),
    db.meetingAttendance.count({ where: { voterId } }),
    db.voter.count({ where: { tenantId: session.user.tenantId, leaderId: voterId } }),
  ])

  const indiceCalculado = calcularIndiceCompromiso({
    encuestasRespondidas,
    encuestasTotal: preguntaIdsActivas.length,
    reunionesAsistidas,
    personasCaptadas,
  })

  const contexto = {
    elector: {
      nombre:         elector.apodo?.trim() || elector.name,
      fechaRegistro:  elector.createdAt.toISOString().slice(0, 10),
      estadoManual:   elector.commitmentStatus,
      ultimoContacto: elector.lastContact?.toISOString().slice(0, 10) ?? 'sin contacto',
    },
    actividad: {
      encuestasRespondidas,
      encuestasTotal: preguntaIdsActivas.length,
      reunionesAsistidas,
      personasCaptadas,
      indiceCalculado: indiceCalculado.score, // heurística sin IA, como referencia
    },
  }

  // Groq (tiempo real), no Zhipu — es lo que este tenant tiene configurado.
  // Si el tenant no configuró su propia clave, se corta acá: NUNCA se cae a
  // la clave global del SaaS a nombre de un tenant (costo/cuota del SaaS,
  // no del tenant) — a diferencia de chatGroq()/chatZhipu(), que sí caen al
  // env global cuando su parámetro apiKey llega undefined.
  const { groq } = await getTenantAiKeys(session.user.tenantId)
  if (!groq) {
    throw new Error('Este tenant no tiene configurada su propia clave de IA (Groq). Configúrala en Configuración antes de generar el veredicto.')
  }
  const respuesta = await chatGroq(SYSTEM_PROMPT_COMPROMISO, JSON.stringify(contexto), groq)

  let resultado: {
    perfilTipo:        string
    indiceCompromiso:  number
    veredicto:         string
    senalesDetectadas: { señal: string; peso: string }[]
    planAccion:        { accion: string; tiempo: string; responsable: string }[] | null
    justificacion:     string
  }
  try {
    resultado = JSON.parse(respuesta)
  } catch {
    throw new Error('El agente IA retornó un JSON inválido. Intente regenerar el análisis.')
  }

  if (
    typeof resultado.perfilTipo !== 'string' ||
    typeof resultado.indiceCompromiso !== 'number' ||
    !Array.isArray(resultado.senalesDetectadas) ||
    typeof resultado.veredicto !== 'string' ||
    typeof resultado.justificacion !== 'string'
  ) {
    throw new Error('El análisis del agente IA no tiene el formato esperado. Campos obligatorios faltantes.')
  }

  const saved = await db.compromisoAnalysis.create({
    data: {
      tenantId:          session.user.tenantId,
      voterId,
      perfilTipo:        resultado.perfilTipo,
      indiceCompromiso:  resultado.indiceCompromiso,
      veredicto:         resultado.veredicto,
      planAccion:        resultado.planAccion ?? undefined,
      senalesDetectadas: resultado.senalesDetectadas,
      justificacion:      resultado.justificacion,
    },
  })

  return formatCompromisoAnalysis(saved)
}

function formatCompromisoAnalysis(analysis: {
  id: string; perfilTipo: string; indiceCompromiso: number; veredicto: string
  planAccion: unknown; senalesDetectadas: unknown; justificacion: string; generadoEn: Date
}): CompromisoAnalysisResult {
  return {
    id:                analysis.id,
    perfilTipo:        analysis.perfilTipo,
    indiceCompromiso:  analysis.indiceCompromiso,
    veredicto:         analysis.veredicto,
    planAccion:        analysis.planAccion as CompromisoAnalysisResult['planAccion'],
    senalesDetectadas: analysis.senalesDetectadas as CompromisoAnalysisResult['senalesDetectadas'],
    justificacion:     analysis.justificacion,
    generadoEn:        analysis.generadoEn.toISOString(),
  }
}

/**
 * Lista electores con paginación y filtros.
 * La cédula NUNCA aparece en el retorno.
 */
export async function listVoters(
  filters?:   VoterFilters,
  pagination: { page: number; pageSize: number } = { page: 1, pageSize: 50 },
): Promise<{ voters: VoterSummary[]; total: number; pages: number }> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], ['CORE_ELECTORES', 'CORE_LIDERES'])
  const db      = await obtenerDbTenant(session.user.tenantId)

  // Los LIDER solo ven su propio sub-árbol; si no está vinculado a un Voter, no ve nada.
  const idsPermitidos = session.user.role === 'LIDER'
    ? (session.user.voterId ? await idsSubarbol(session.user.voterId, session.user.tenantId, db) : new Set<string>())
    : null

  const where: any = {
    tenantId: session.user.tenantId,
    ...(idsPermitidos             && { id: { in: [...idsPermitidos] } }),
    ...(filters?.leaderId         && { leaderId:         filters.leaderId }),
    ...(filters?.commitmentStatus && { commitmentStatus: filters.commitmentStatus }),
    ...(filters?.search           && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { cedulaHash: calcularCedulaHash(filters.search) },
      ],
    }),
  }

  const [total, electores] = await Promise.all([
    db.voter.count({ where }),
    db.voter.findMany({
      where,
      select: {
        id:               true,
        name:             true,
        leaderId:         true,
        votingTableId:    true,
        commitmentStatus: true,
        lastContact:      true,
        notes:            true,
        // cedula y phone: NUNCA (PII)
      },
      orderBy: { name: 'asc' },
      skip:   (pagination.page - 1) * pagination.pageSize,
      take:   pagination.pageSize,
    }),
  ])

  const pages = Math.ceil(total / pagination.pageSize)

  return {
    voters: electores as VoterSummary[],
    total,
    pages,
  }
}

export interface VoterDetalle {
  id:               string
  name:             string
  apodo:            string | null
  // Descifrado server-side, a diferencia de VoterSummary — acá sí hace
  // falta (ficha de un único elector, mismo precedente que
  // /api/core/mis-electores para click-to-call).
  phone:            string | null
  address:          string | null
  commitmentStatus: CommitmentStatus
  lastContact:      Date | null
  notes:            string | null
  leaderId:         string | null
  leaderName:       string | null
  isCandidate:      boolean
  tieneAgenda:      boolean
}

/** Ficha de un elector puntual — para /core/electores/[id]. */
export async function getVoterDetalle(id: string): Promise<VoterDetalle | null> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], 'CORE_ELECTORES')
  const db      = await obtenerDbTenant(session.user.tenantId)

  if (session.user.role === 'LIDER') {
    if (!session.user.voterId) return null
    const permitidos = await idsSubarbol(session.user.voterId, session.user.tenantId, db)
    if (!permitidos.has(id)) return null
  }

  const v = await db.voter.findFirst({
    where:  { id, tenantId: session.user.tenantId },
    select: {
      id: true, name: true, apodo: true, phone: true, address: true,
      commitmentStatus: true, lastContact: true, notes: true,
      leaderId: true, isCandidate: true, tieneAgenda: true,
      leader: { select: { name: true } },
    },
  })
  if (!v) return null

  let phonePlain: string | null = null
  if (v.phone) {
    try {
      phonePlain = decrypt(v.phone)
    } catch {
      console.error(`[getVoterDetalle] phone no descifrable para voter ${v.id}`)
    }
  }

  return {
    id: v.id, name: v.name, apodo: v.apodo, phone: phonePlain, address: v.address,
    commitmentStatus: v.commitmentStatus, lastContact: v.lastContact, notes: v.notes,
    leaderId: v.leaderId, leaderName: v.leader?.name ?? null, isCandidate: v.isCandidate,
    tieneAgenda: v.tieneAgenda,
  }
}

/**
 * Importación masiva de electores desde CSV/Excel.
 * Procesa en batches de 100 para evitar timeouts.
 * La cédula se cifra por cada registro.
 */
export async function importVoters(rows: ImportVoterRow[]): Promise<ImportResult> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_IMPORTAR', 'edit')
  const tenantId = session.user.tenantId
  const db       = await obtenerDbTenant(tenantId)

  // Construir mapa nombre → id para resolución rápida. Cualquier elector puede
  // ser el líder destino (incluye a quien recién se está armando su primera
  // lista), no solo quienes ya tienen followers.
  const lideres = await db.voter.findMany({
    where:  { tenantId },
    select: { id: true, name: true },
  })
  const mapaLideres = new Map(lideres.map((l) => [l.name.toLowerCase(), l.id]))

  let created = 0
  let skipped = 0
  const errors: string[] = []

  // Procesar en batches de 100
  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    const lote = rows.slice(i, i + BATCH)

    for (let j = 0; j < lote.length; j++) {
      const row      = lote[j]
      const lineaNum = i + j + 1

      if (!row.cedula?.trim() || !row.name?.trim()) {
        errors.push(`Fila ${lineaNum}: cédula y nombre son obligatorios.`)
        continue
      }

      const leaderId = row.leaderName
        ? mapaLideres.get(row.leaderName.toLowerCase())
        : undefined

      if (row.leaderName && !leaderId) {
        errors.push(`Fila ${lineaNum}: líder "${row.leaderName}" no encontrado — se importa sin líder.`)
      }

      const cedulaNorm   = row.cedula.trim()
      const cedulaHash   = calcularCedulaHash(cedulaNorm)
      const cedulaCifrada = encrypt(cedulaNorm)

      // Verificación explícita por cedulaHash para distinguir:
      //   mismo líder  → skip silencioso
      //   otro líder   → alerta de duplicado
      const existente = await db.voter.findFirst({
        where:  { tenantId: session.user.tenantId, cedulaHash },
        select: { id: true, leaderId: true },
      })

      if (existente) {
        if (existente.leaderId !== (leaderId ?? null)) {
          await crearAlertaDuplicado(
            {
              tenantId:          session.user.tenantId,
              cedulaHash,
              firstLeaderId:     existente.leaderId ?? (leaderId ?? ''),
              duplicateLeaderId: leaderId ?? existente.leaderId ?? '',
            },
            db as any,
          )
          errors.push(`Fila ${lineaNum}: cédula ya existe bajo otro líder — se generó alerta de duplicado.`)
        }
        skipped++
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nuevo = await (db.voter.create as any)({
        data: {
          tenantId,
          cedula:           cedulaCifrada,
          cedulaHash,
          name:             row.name.trim(),
          phone:            row.phone ? encrypt(row.phone) : undefined,
          leaderId:         leaderId ?? undefined,
          commitmentStatus: row.commitmentStatus ?? 'SIN_CONTACTAR',
        },
      })
      await crearQrPropio(nuevo.id, tenantId, db)
      created++
    }
  }

  revalidatePath('/core/electores')
  return { created, skipped, errors }
}

// ── Alerta de duplicados ──────────────────────────────────────────────────────

interface AlertaDuplicadoInput {
  tenantId:          string
  cedulaHash:        string
  firstLeaderId:     string   // Líder que registró primero
  duplicateLeaderId: string   // Líder que intentó registrar después
  // userId de cada líder para enviarles la notificación
  firstUserId?:      string
  duplicateUserId?:  string
}

/**
 * Crea un VoterDuplicateAlert y dos Notifications (una por líder involucrado).
 * Función reutilizada por importación Excel y por registro por QR.
 * La cédula NUNCA aparece aquí — solo su SHA-256.
 */
export async function crearAlertaDuplicado(
  data:   AlertaDuplicadoInput,
  db:     ReturnType<typeof getTenantDb>,
): Promise<void> {
  // Crear alerta
  await db.voterDuplicateAlert.create({
    data: {
      tenantId:          data.tenantId,
      cedulaHash:        data.cedulaHash,
      firstLeaderId:     data.firstLeaderId,
      duplicateLeaderId: data.duplicateLeaderId,
    },
  })

  // Crear notificación para el líder original (el que registró primero)
  if (data.firstUserId) {
    await db.notification.create({
      data: {
        tenantId: data.tenantId,
        userId:   data.firstUserId,
        type:     'DUPLICADO_ELECTOR',
        message:  'La persona que registraste también aparece en la lista de otro líder. Eres el registrador original.',
        metadata: { cedulaHash: data.cedulaHash, duplicateLeaderId: data.duplicateLeaderId },
      },
    })
  }

  // Crear notificación para el líder que intentó duplicar
  if (data.duplicateUserId) {
    await db.notification.create({
      data: {
        tenantId: data.tenantId,
        userId:   data.duplicateUserId,
        type:     'DUPLICADO_ELECTOR',
        message:  'La persona que intentaste registrar ya está vinculada a otro líder. No fue agregada a tu lista.',
        metadata: { cedulaHash: data.cedulaHash, firstLeaderId: data.firstLeaderId },
      },
    })
  }
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface CoreStats {
  lideres:   number
  electores: number
  puestos:   number
  mesas:     number
}

/** Conteos para el dashboard del módulo CORE. Accesible a todos los roles del tenant. */
export async function getCoreStats(): Promise<CoreStats> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], 'CORE_DASHBOARD')
  const db      = await obtenerDbTenant(session.user.tenantId)

  // Voter lleva tenantId (defensa en profundidad además de la DB aislada).
  // VotingStation/VotingTable son territoriales (DIVIPOLA) — sin tenantId.
  const liderIds = await idsLideres(session.user.tenantId, db)
  const [lideres, electores, puestos, mesas] = await Promise.all([
    db.voter.count({ where: { tenantId: session.user.tenantId, isCandidate: false, id: { in: [...liderIds] } } }),
    db.voter.count({ where: { tenantId: session.user.tenantId } }),
    db.votingStation.count(),
    db.votingTable.count(),
  ])

  return { lideres, electores, puestos, mesas }
}

// ── Ranking de captadores (HALLAZGO 9) ─────────────────────────────────────────

export interface LeaderRankingEntry {
  id:                    string
  name:                  string
  zone:                  string | null
  totalDownline:         number // directos + todo el sub-árbol (no solo followers directos)
  comprometidosDownline: number
  profundidad:           number // niveles de sub-líderes debajo de este
  directos:              number // followers inmediatos — el otro eje del título
  titulos:               TituloLider[]
}

/**
 * Rankea líderes (a cualquier nivel del árbol, no solo raíces) por el tamaño
 * de todo su sub-árbol de electores — no solo sus followers directos, como
 * hace listLeaders(). "Quién trae más gente", contando sub-líderes propios.
 */
export async function getLeaderRanking(limit?: number): Promise<LeaderRankingEntry[]> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], 'CORE_DASHBOARD')
  const db      = await obtenerDbTenant(session.user.tenantId)

  const todos = await db.voter.findMany({
    where:  { tenantId: session.user.tenantId },
    select: { id: true, name: true, zone: true, leaderId: true, commitmentStatus: true, isCandidate: true },
  })

  const hijosPorLider = new Map<string, typeof todos>()
  for (const v of todos) {
    if (!v.leaderId) continue
    const lista = hijosPorLider.get(v.leaderId) ?? []
    lista.push(v)
    hijosPorLider.set(v.leaderId, lista)
  }

  const cache = new Map<string, { total: number; comprometidos: number; profundidad: number }>()
  function subarbol(id: string): { total: number; comprometidos: number; profundidad: number } {
    const cacheado = cache.get(id)
    if (cacheado) return cacheado

    const hijos = hijosPorLider.get(id) ?? []
    let total         = hijos.length
    let comprometidos = hijos.filter((h) => h.commitmentStatus === 'COMPROMETIDO' || h.commitmentStatus === 'VOTO_SEGURO').length
    let profundidad   = hijos.length > 0 ? 1 : 0

    for (const h of hijos) {
      const sub = subarbol(h.id)
      total         += sub.total
      comprometidos += sub.comprometidos
      profundidad    = Math.max(profundidad, 1 + sub.profundidad)
    }

    const resultado = { total, comprometidos, profundidad }
    cache.set(id, resultado)
    return resultado
  }

  const ranking = todos
    // Califica quien tenga ALGÚN título: por reclutar de su propia mano o por
    // la red que construyó. Antes solo contaban los directos, así que quien
    // armaba una red grande a través de sus reclutados no aparecía.
    // El candidato cuenta para el sub-árbol de quien sí aparece, pero no se lista él mismo.
    .map((v) => {
      const s        = subarbol(v.id)
      const directos = hijosPorLider.get(v.id)?.length ?? 0
      return {
        id: v.id, name: v.name, zone: v.zone,
        totalDownline: s.total, comprometidosDownline: s.comprometidos, profundidad: s.profundidad,
        directos, titulos: v.isCandidate ? [] : titulosDe(directos, s.total),
      }
    })
    .filter((v) => v.titulos.length > 0)
    .sort((a, b) => b.totalDownline - a.totalDownline)

  return limit ? ranking.slice(0, limit) : ranking
}

// ── Mapa de electores geolocalizados ──────────────────────────────────────────

export interface VoterGeo {
  id:               string
  name:             string
  lat:              number
  lng:              number
  commitmentStatus: string
  leaderName:       string | null
  /** Barrio donde vive, para poder acotar el mapa a uno solo. null si cayó fuera de todo polígono. */
  neighborhoodId:   string | null
  neighborhoodName: string | null
}

/** Electores ya geocodificados (con lat/lng), para plotear en el mapa. */
export async function getVotersGeo(): Promise<VoterGeo[]> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], 'CORE_DASHBOARD')
  const db      = await obtenerDbTenant(session.user.tenantId)

  const rows = await db.voter.findMany({
    where:  { tenantId: session.user.tenantId, lat: { not: null }, lng: { not: null } },
    select: {
      id: true, name: true, lat: true, lng: true, commitmentStatus: true,
      leader: { select: { name: true } },
      neighborhood: { select: { id: true, name: true } },
    },
  })

  return rows.map((r) => ({
    id: r.id, name: r.name, lat: r.lat!, lng: r.lng!, commitmentStatus: r.commitmentStatus,
    leaderName: r.leader?.name ?? null,
    neighborhoodId: r.neighborhood?.id ?? null,
    neighborhoodName: r.neighborhood?.name ?? null,
  }))
}

/**
 * Crea el QR propio de los electores que no lo tengan. Toda alta ya lo genera
 * sola (createVoter, registro por QR, import de Excel, admin del tenant); esto
 * es para los que entraron por fuera de la app — una siembra o una carga
 * directa a la DB. Idempotente: correrla dos veces no crea nada la segunda.
 */
export async function generarQrFaltantes(): Promise<{ creados: number; total: number }> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_QR', 'edit')
  const tenantId = session.user.tenantId
  const db       = await obtenerDbTenant(tenantId)

  const electores = await db.voter.findMany({ where: { tenantId }, select: { id: true } })
  const conQr     = await db.qrRegistration.findMany({
    where:  { tenantId, isActive: true, leaderId: { in: electores.map((e) => e.id) } },
    select: { leaderId: true },
  })
  const yaTienen = new Set(conQr.map((q) => q.leaderId))

  let creados = 0
  for (const e of electores) {
    if (yaTienen.has(e.id)) continue
    await crearQrPropio(e.id, tenantId, db)
    creados++
  }

  revalidatePath('/core/qr')
  return { creados, total: electores.length }
}

export interface GeoStats { conCoords: number; pendientes: number }

/** Conteo de electores ubicados vs. pendientes de geocodificar (tienen dirección, no coords). */
export async function getGeoStats(): Promise<GeoStats> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], 'CORE_DASHBOARD')
  const db      = await obtenerDbTenant(session.user.tenantId)
  const tenantId = session.user.tenantId

  const [conCoords, pendientes] = await Promise.all([
    db.voter.count({ where: { tenantId, lat: { not: null } } }),
    db.voter.count({ where: { tenantId, lat: null, address: { not: null } } }),
  ])
  return { conCoords, pendientes }
}

/**
 * Geocodifica un LOTE PEQUEÑO de electores con dirección pero sin coordenadas.
 * ponytail: lote de 5 con pausa de 1s por el rate limit de Nominatim (1 req/s) y
 * el timeout de la función serverless. Para volúmenes grandes esto es un cron/queue,
 * no una acción síncrona — por ahora el admin la corre varias veces.
 */
export async function geocodificarPendientes(): Promise<{ geocodificados: number; restantes: number }> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_DASHBOARD', 'edit')
  const db       = await obtenerDbTenant(session.user.tenantId)
  const tenantId = session.user.tenantId

  const lote = await db.voter.findMany({
    where:  { tenantId, lat: null, address: { not: null } },
    select: { id: true, address: true },
    take:   5,
  })

  let geocodificados = 0
  for (const v of lote) {
    const coords = await geocodeAddress(v.address!)
    if (coords) {
      await db.voter.update({ where: { id: v.id }, data: { lat: coords.lat, lng: coords.lng } })
      geocodificados++
    }
    await new Promise((r) => setTimeout(r, 1000)) // 1 req/s (política de Nominatim)
  }

  // Ya tienen coordenadas: ubicarlos en su barrio en la misma pasada, así nadie
  // tiene que acordarse de correrlo aparte.
  if (geocodificados > 0) await resolverBarrios(db, tenantId)

  const restantes = await db.voter.count({ where: { tenantId, lat: null, address: { not: null } } })
  revalidatePath('/core')
  return { geocodificados, restantes }
}

// ── Jurisdicción electoral ──────────────────────────────────────────────────────
// Un voto solo cuenta si el elector está dentro de la jurisdicción del cargo:
// ALCALDE/CONCEJAL → municipio; GOBERNADOR/DIPUTADO/REPRESENTANTE → departamento;
// SENADOR/PRESIDENTE → nacional (sin restricción). La fuente de "dónde vota" es
// la mesa (votingTableId), nunca la dirección de residencia.

type EstadoJurisdiccion = 'CUENTA' | 'NO_CUENTA' | 'SIN_VERIFICAR'

const CARGOS_NACIONALES      = ['SENADOR', 'PRESIDENTE']
const CARGOS_DEPARTAMENTALES = ['GOBERNADOR', 'DIPUTADO', 'REPRESENTANTE']
const CARGOS_MUNICIPALES     = ['ALCALDE', 'CONCEJAL']

function resolverJurisdiccion(
  cfg: { office: Cargo | null; departmentCode: string | null; municipalityDivipola: string | null },
  ubicacion: { divipola: string; departmentCode: string } | null, // null = sin votingTableId
): EstadoJurisdiccion {
  if (!cfg.office || CARGOS_NACIONALES.includes(cfg.office)) return 'CUENTA'
  if (!ubicacion) return 'SIN_VERIFICAR'

  if (CARGOS_MUNICIPALES.includes(cfg.office)) {
    if (!cfg.municipalityDivipola) return 'SIN_VERIFICAR'
    return ubicacion.divipola === cfg.municipalityDivipola ? 'CUENTA' : 'NO_CUENTA'
  }
  if (CARGOS_DEPARTAMENTALES.includes(cfg.office)) {
    if (!cfg.departmentCode) return 'SIN_VERIFICAR'
    return ubicacion.departmentCode === cfg.departmentCode ? 'CUENTA' : 'NO_CUENTA'
  }
  return 'SIN_VERIFICAR'
}

export interface JurisdictionStats {
  cuenta:       number
  noCuenta:     number
  sinVerificar: number
}

/** Cuántos electores del tenant cuentan / no cuentan / no se puede determinar, según la config de elección. */
export async function getJurisdictionStats(): Promise<JurisdictionStats> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], 'CORE_DASHBOARD')
  const db       = await obtenerDbTenant(session.user.tenantId)
  const tenantId = session.user.tenantId

  const config = await db.tenantConfig.findUnique({ where: { tenantId } })
  const cfg = {
    office:               (config?.electionOffice as Cargo | null) ?? null,
    departmentCode:       config?.electionDepartmentCode ?? null,
    municipalityDivipola: config?.electionMunicipalityDivipola ?? null,
  }

  const total = await db.voter.count({ where: { tenantId } })

  // Cargo nacional o sin configurar: todos cuentan, sin necesidad de joins.
  if (!cfg.office || CARGOS_NACIONALES.includes(cfg.office)) {
    return { cuenta: total, noCuenta: 0, sinVerificar: 0 }
  }

  const sinMesa = await db.voter.count({ where: { tenantId, votingTableId: null } })

  const conMesa = await db.$queryRaw<{ divipola: string; departmentCode: string }[]>`
    SELECT m.divipola, d.code AS "departmentCode"
    FROM "Voter" v
    JOIN "VotingTable"   vt ON v."votingTableId"   = vt.id
    JOIN "VotingStation" vs ON vt."stationId"      = vs.id
    JOIN "Municipality"  m  ON vs."municipalityId" = m.id
    JOIN "Department"    d  ON m."departmentId"    = d.id
    WHERE v."tenantId" = ${tenantId}
  `

  let cuenta = 0, noCuenta = 0, sinVerificar = sinMesa
  for (const row of conMesa) {
    const estado = resolverJurisdiccion(cfg, row)
    if (estado === 'CUENTA') cuenta++
    else if (estado === 'NO_CUENTA') noCuenta++
    else sinVerificar++
  }

  return { cuenta, noCuenta, sinVerificar }
}

export interface StationGeo {
  id:             string
  name:           string
  lat:            number
  lng:            number
  totalElectores: number
  estado:         'CUENTA' | 'NO_CUENTA'
  specialLabel:   string | null
}

/** Puestos de votación con electores propios asignados, para la vista de mapa "por puesto". */
export async function getVotingStationsGeo(): Promise<StationGeo[]> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], 'CORE_DASHBOARD')
  const db       = await obtenerDbTenant(session.user.tenantId)
  const tenantId = session.user.tenantId

  const config = await db.tenantConfig.findUnique({ where: { tenantId } })
  const cfg = {
    office:               (config?.electionOffice as Cargo | null) ?? null,
    departmentCode:       config?.electionDepartmentCode ?? null,
    municipalityDivipola: config?.electionMunicipalityDivipola ?? null,
  }

  const rows = await db.$queryRaw<{
    id: string; name: string; lat: number; lng: number; specialLabel: string | null
    divipola: string; departmentCode: string; total: bigint
  }[]>`
    SELECT vs.id, vs.name, vs.lat, vs.lng, vs."specialLabel", m.divipola, d.code AS "departmentCode",
           COUNT(v.id)::bigint AS total
    FROM "Voter" v
    JOIN "VotingTable"   vt ON v."votingTableId"   = vt.id
    JOIN "VotingStation" vs ON vt."stationId"      = vs.id
    JOIN "Municipality"  m  ON vs."municipalityId" = m.id
    JOIN "Department"    d  ON m."departmentId"    = d.id
    WHERE v."tenantId" = ${tenantId}
      AND vs.lat IS NOT NULL AND vs.lng IS NOT NULL
    GROUP BY vs.id, vs.name, vs.lat, vs.lng, vs."specialLabel", m.divipola, d.code
  `

  return rows.map((r) => ({
    id: r.id, name: r.name, lat: r.lat, lng: r.lng, totalElectores: Number(r.total),
    specialLabel: r.specialLabel,
    estado: resolverJurisdiccion(cfg, r) === 'NO_CUENTA' ? 'NO_CUENTA' : 'CUENTA',
  }))
}

export interface CentroMunicipio {
  lat:  number
  lng:  number
  name: string
}

/**
 * Centro del municipio configurado para la campaña, para encuadrar los mapas
 * cuando todavía no hay datos propios que encuadrar.
 *
 * Sin esto una campaña recién creada abre el dashboard mirando Colombia entera,
 * aunque ya haya elegido departamento y municipio: los mapas solo se acercaban
 * a partir de puestos con electores o comunas con límites, y una campaña nueva
 * no tiene ninguno de los dos.
 *
 * DIVIPOLA no trae coordenadas, así que la primera vez se geocodifica el nombre
 * del municipio y se guarda en Municipality. A partir de ahí sale de la DB: una
 * sola llamada a Nominatim por municipio, nunca una por visita al dashboard.
 */
export async function getCentroMunicipio(): Promise<CentroMunicipio | null> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], 'CORE_DASHBOARD')
  const db       = await obtenerDbTenant(session.user.tenantId)
  const tenantId = session.user.tenantId

  const config = await db.tenantConfig.findUnique({
    where:  { tenantId },
    select: { electionMunicipalityDivipola: true },
  })
  const divipola = config?.electionMunicipalityDivipola
  if (!divipola) return null // campaña sin municipio configurado: no hay dónde centrar

  const municipio = await db.municipality.findUnique({
    where:  { divipola },
    select: { id: true, name: true, lat: true, lng: true, department: { select: { name: true } } },
  })
  if (!municipio) return null

  if (municipio.lat !== null && municipio.lng !== null) {
    return { lat: municipio.lat, lng: municipio.lng, name: municipio.name }
  }

  // Con el departamento y el país, si no "Buga" cae en cualquier otro país.
  const punto = await geocodeAddress(`${municipio.name}, ${municipio.department.name}, Colombia`)
  if (!punto) return null // best-effort: sin centro, el mapa se queda como estaba

  await db.municipality.update({
    where: { id: municipio.id },
    data:  { lat: punto.lat, lng: punto.lng },
  })
  return { lat: punto.lat, lng: punto.lng, name: municipio.name }
}

export interface ComunaGeo {
  id:             string
  name:           string
  boundary:       [number, number][]
  totalElectores: number
  /** Mismo color que muestra esta zona en Territorio. */
  color:          string
}

/** Comunas con polígono real y cuántos electores propios (geocodificados) caen dentro, para la vista de mapa "por comuna". */
export async function getElectoresPorComuna(): Promise<ComunaGeo[]> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'], 'CORE_DASHBOARD')
  const db       = await obtenerDbTenant(session.user.tenantId)
  const tenantId = session.user.tenantId

  const [comunas, electores] = await Promise.all([
    // Se traen TODAS, no solo las que tienen polígono: el color depende de la
    // posición dentro de la lista completa del municipio ordenada por nombre,
    // que es la misma que usa Territorio. Filtrar antes correría los índices y
    // una comuna tendría un color aquí y otro allá.
    db.commune.findMany({ orderBy: [{ municipalityId: 'asc' }, { name: 'asc' }] }),
    db.voter.findMany({
      where:  { tenantId, lat: { not: null }, lng: { not: null } },
      select: { lat: true, lng: true },
    }),
  ])

  const porMunicipio = new Map<string, string[]>()
  for (const c of comunas) {
    porMunicipio.set(c.municipalityId, [...(porMunicipio.get(c.municipalityId) ?? []), c.id])
  }
  const colores = new Map<string, string>()
  for (const ids of porMunicipio.values()) {
    for (const [id, color] of coloresPorZona(ids)) colores.set(id, color)
  }

  return comunas
    .filter((c) => c.boundary !== null)
    .map((c) => {
      const boundary = c.boundary as unknown as [number, number][]
      const totalElectores = electores.filter((e) => puntoEnPoligono([e.lat!, e.lng!], boundary)).length
      return { id: c.id, name: c.name, boundary, totalElectores, color: colores.get(c.id)! }
    })
}

export interface StationOption {
  id:     string
  name:   string
  tables: { id: string; number: number }[]
}

/** Puestos de votación del tenant con sus mesas, para el selector puesto→mesa. */
export async function listVotingStations(): Promise<StationOption[]> {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_ELECTORES')
  const db      = await obtenerDbTenant(session.user.tenantId)

  return db.votingStation.findMany({
    select: {
      id:     true,
      name:   true,
      tables: { select: { id: true, number: true } },
    },
    orderBy: { name: 'asc' },
  })
}
