'use server'

/**
 * Server Actions del módulo DIA_E.
 * Todas las acciones verifican autenticación, rol y módulo con requireModule('DIA_E').
 * groqResult y zhipuResult NUNCA se retornan al cliente — solo auditoría.
 */

import { requireModule, requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb, Prisma, superadminDb, decrypt } from '@vectra/db'
import * as XLSX                from 'xlsx'
import { calcularCedulaHash }   from '@/lib/cedula-hash'
import { normalizarClavesE14, actaEsDeLaMesa, actaEsDelPuesto } from '@/lib/e14'
import {
  compararListados,
  cubreLaMesa,
  type TestigoPropuesto,
  type FilaAprobada,
  type ResultadoComparacion,
  type TipoCambio,
}                               from './_lib/registraduria'
import {
  verificarTresFuentes,
  type VotoPorCandidato,
}                               from '@/lib/verificacion-e14'
import {
  extractE14WithGroq,
  extractE14WithZhipu,
  extractE14WithMistral,
  consensoE14,
  type E14ExtractionResult as E14Lectura,
}                              from '@vectra/ai'
import { getTenantAiKeys }     from '@/lib/tenant-ai'
import { put }                 from '@vercel/blob'
import { revalidatePath }      from 'next/cache'

// ── Helper ───────────────────────────────────────────────────────────────────

async function getDbAndSession(
  roles: Parameters<typeof requireModule>[1] = [],
  screenKey?: string,
  accion: 'view' | 'edit' = 'view',
) {
  const session  = screenKey
    ? await requireModuleOrScreen('DIA_E', roles, screenKey, accion)
    : await requireModule('DIA_E', roles)
  const tenantId = session.user.tenantId as string
  const userId   = session.user.userId
  const conn     = await getTenantConnection(tenantId)
  const db       = getTenantDb(conn)
  return { db, tenantId, userId, session }
}

// ── Tipos exportados ─────────────────────────────────────────────────────────

export interface CandidateView {
  id:    string
  name:  string
  party: string | null
  partyLogoUrl: string | null
  photoUrl:     string | null
  isOwn: boolean
  order: number
}

export interface WitnessAssignmentView {
  id:            string
  userId:        string
  userEmail:     string
  userName:      string | null
  votingTableId: string
  tableNumber:   number
  stationName:   string
  municipality:  string
  department:    string
  isPrimary:     boolean
  confirmedAt:   Date | null
  /** Trámite ante la Registraduría: PROPUESTO | APROBADO | RECHAZADO. */
  estado:        string | null
  observacion:   string | null
  /** false = hay un testigo asignado pero la mesa quedó descubierta (rechazado). */
  cubierta:      boolean
}

export interface MyAssignment {
  assignmentId:  string
  votingTableId: string
  tableNumber:   number
  stationName:   string
  stationAddress: string
  municipality:  string
  department:    string
  // Códigos DIVIPOLA — el E-14 físico los imprime junto al nombre
  // ("DEPARTAMENTO: 11 - CAUCA", "MUNICIPIO: 001 - POPAYAN").
  departmentCode:       string
  municipalityDivipola: string
  /** Cargo en disputa (ALCALDE, CONCEJAL…) — encabeza el acta. De TenantConfig. */
  cargo:         string | null
  isPrimary:     boolean
  confirmedAt:   Date | null
}

export interface TransmissionView {
  id:                  string
  votingTableId:       string
  tableNumber:         number
  stationName:         string
  witnessEmail:        string
  verificationStatus:  string
  ownCandidateVotes:   number | null
  transmittedAt:       Date | null
  // Las tres fuentes obligatorias: mientras falte una, la mesa está INCOMPLETA.
  hasManual:           boolean
  hasPhoto:            boolean
  hasRegistraduria:    boolean
  extractionConfidence: string | null
  /** Número impreso en el acta fotografiada, como lo leyó la IA ("014"). */
  actaMesaNumero:      string | null
  /** Puesto impreso en el acta fotografiada, como lo leyó la IA. */
  actaPuestoNombre:    string | null
  /**
   * true = el acta fotografiada dice ser de OTRA mesa o de OTRO puesto.
   * null = no se pudo saber (la IA no leyó ninguno de los dos, o no hay foto).
   */
  actaCruzada:         boolean | null
  /** Qué dice el acta que no cuadra ("mesa 014", "puesto Colegio X"), ya listo
   *  para mostrar. null cuando no está cruzada. */
  actaCruzadaDetalle:  string | null
}

export interface TransmissionDetail {
  id:                   string
  votingTableId:        string
  tableNumber:          number
  stationName:          string
  witnessEmail:         string
  verificationStatus:   string
  manualData:           { candidateId: string; votes: number }[] | null
  manualTotal:          number | null
  extractedData:        { candidateId: string; votes: number }[] | null
  extractedTotal:       number | null
  extractionConfidence: string | null
  registraduriaData:    { candidateId: string; votes: number }[] | null
  registraduriaTotal:   number | null
  registraduriaAt:      Date | null
  registraduriaFuente:  string | null
  discrepancias:        { candidateId: string; valores: Record<string, number>; diferencia: number }[] | null
  finalData:            { candidateId: string; votes: number }[] | null
  photoUrl:             string | null
  notes:                string | null
  manualSubmittedAt:    Date | null
  photoSubmittedAt:     Date | null
  /** Para poner nombre a los candidateId que vienen en cada fuente. */
  candidatos:           { id: string; name: string }[]
}

export interface IncidentView {
  id:            string
  reportedBy:    string
  reporterEmail: string
  votingTableId: string | null
  type:          string
  description:   string
  severity:      string
  photoUrl:      string | null
  status:        string
  createdAt:     Date
}

export interface ElectionResultView {
  candidateId:   string
  candidateName: string
  party:         string | null
  isOwn:         boolean
  totalVotes:    number
  tableCount:    number
  totalTables:   number
  percentage:    number
}

export interface DashboardDiaE {
  mesasTotales:       number
  mesasConTestigo:    number
  mesasTransmitidas:  number
  mesasVerificadas:   number
  /** Fuentes que no cuadran — candidatas a demanda. */
  mesasDisputa:       number
  /** Transmitidas pero les falta al menos una de las tres fuentes. */
  mesasIncompletas:   number
  mesasSinReportar:   number
  incidentesAlta:     number
  incidentesMedia:    number
  incidentesBaja:     number
}

// ── CANDIDATOS ───────────────────────────────────────────────────────────────

/**
 * El candidato propio NO se captura acá: ya está marcado en CORE
 * (Voter.isCandidate, ver setCandidato). Esta función lo refleja en la tabla
 * Candidate — que sí necesita fila propia porque el E-14 referencia
 * candidateId — creándolo la primera vez y sincronizando el nombre si cambió.
 * Idempotente: se puede llamar en cada listCandidates() sin efectos raros.
 */
async function sincronizarCandidatoPropio(
  db: ReturnType<typeof getTenantDb>,
  tenantId: string,
): Promise<void> {
  const voterCandidato = await db.voter.findFirst({
    where:  { tenantId, isCandidate: true },
    select: { name: true },
  })
  const filaPropia = await db.candidate.findFirst({ where: { tenantId, isOwn: true } })

  if (!voterCandidato) {
    // Se desmarcó el candidato en CORE — la fila queda, pero deja de ser "propia"
    // (no se borra: puede tener votos de E-14 ya transmitidos apuntando a ella).
    if (filaPropia) await db.candidate.update({ where: { id: filaPropia.id }, data: { isOwn: false } })
    return
  }

  if (!filaPropia) {
    await db.candidate.create({
      data: { tenantId, name: voterCandidato.name, isOwn: true, order: 0 },
    })
  } else if (filaPropia.name !== voterCandidato.name) {
    await db.candidate.update({ where: { id: filaPropia.id }, data: { name: voterCandidato.name } })
  }
}

export async function listCandidates(): Promise<CandidateView[]> {
  const { db, tenantId } = await getDbAndSession()
  await sincronizarCandidatoPropio(db, tenantId)
  // Por número de tarjetón — es el orden del acta física, no "el nuestro primero".
  return db.candidate.findMany({ where: { tenantId }, orderBy: { order: 'asc' } })
}

/** Sube un archivo a Vercel Blob y devuelve su URL; null si no vino archivo. */
async function subirImagen(file: File | null, tenantId: string, prefijo: string): Promise<string | null> {
  if (!file || file.size === 0) return null
  const blob = await put(`dia-e/${tenantId}/${prefijo}-${Date.now()}-${file.name}`, file, { access: 'public' })
  return blob.url
}

/**
 * Alta de candidato RIVAL — el propio se toma de CORE (ver sincronizarCandidatoPropio).
 * Recibe FormData porque trae foto y logo de la agrupación.
 */
export async function createCandidate(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'DIA_E_CONFIGURACION', 'edit')

    const name  = String(formData.get('name') ?? '').trim()
    const party = String(formData.get('party') ?? '').trim()
    const order = parseInt(String(formData.get('order') ?? '0')) || 0
    if (!name) return { success: false, error: 'Falta el nombre del candidato.' }

    const [photoUrl, partyLogoUrl] = await Promise.all([
      subirImagen(formData.get('photo') as File | null, tenantId, 'foto'),
      subirImagen(formData.get('partyLogo') as File | null, tenantId, 'logo'),
    ])

    await db.candidate.create({
      data: { tenantId, name, party: party || null, partyLogoUrl, photoUrl, isOwn: false, order },
    })
    revalidatePath('/dia-e/sala/configuracion')
    return { success: true }
  } catch (err) {
    console.error('[createCandidate]', err instanceof Error ? err.message : err)
    return { success: false, error: 'No se pudo crear el candidato.' }
  }
}

/**
 * Completa foto / agrupación / número de tarjetón de un candidato ya existente
 * — incluido el propio, cuyo NOMBRE sigue viniendo de CORE (no se toca acá).
 */
export async function actualizarDatosTarjeton(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'DIA_E_CONFIGURACION', 'edit')

    const id = String(formData.get('id') ?? '')
    const candidato = await db.candidate.findFirst({ where: { id, tenantId } })
    if (!candidato) return { success: false, error: 'Candidato no encontrado.' }

    const party    = String(formData.get('party') ?? '').trim()
    const ordenRaw = String(formData.get('order') ?? '')
    const [photoUrl, partyLogoUrl] = await Promise.all([
      subirImagen(formData.get('photo') as File | null, tenantId, 'foto'),
      subirImagen(formData.get('partyLogo') as File | null, tenantId, 'logo'),
    ])

    await db.candidate.update({
      where: { id },
      data: {
        ...(party      !== ''   && { party }),
        ...(ordenRaw   !== ''   && { order: parseInt(ordenRaw) || 0 }),
        ...(photoUrl     !== null && { photoUrl }),      // solo si subieron una nueva
        ...(partyLogoUrl !== null && { partyLogoUrl }),
      },
    })
    revalidatePath('/dia-e/sala/configuracion')
    return { success: true }
  } catch (err) {
    console.error('[actualizarDatosTarjeton]', err instanceof Error ? err.message : err)
    return { success: false, error: 'No se pudo actualizar.' }
  }
}

export async function updateCandidate(
  id: string,
  data: { name?: string; party?: string; isOwn?: boolean; order?: number },
): Promise<{ success: boolean }> {
  try {
    const { db } = await getDbAndSession(['ADMIN_CAMPANA'], 'DIA_E_CONFIGURACION', 'edit')
    await db.candidate.update({ where: { id }, data })
    revalidatePath('/dia-e/sala/configuracion')
    return { success: true }
  } catch (err) {
    console.error('[updateCandidate]', err instanceof Error ? err.message : err)
    return { success: false }
  }
}

export async function deleteCandidate(id: string): Promise<{ success: boolean; error?: string }> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA'], 'DIA_E_CONFIGURACION', 'edit')

  const candidato = await db.candidate.findFirst({ where: { id, tenantId } })
  if (!candidato) return { success: false, error: 'Candidato no encontrado.' }
  // El propio se administra desde CORE (ficha del elector → "Marcar como candidato"),
  // no desde acá — si no, quedaría desincronizado con Voter.isCandidate.
  if (candidato.isOwn) {
    return { success: false, error: 'El candidato propio se cambia en CORE, en la ficha del elector.' }
  }

  await db.candidate.delete({ where: { id } })
  revalidatePath('/dia-e/sala/configuracion')
  return { success: true }
}

// ── ASIGNACIÓN DE TESTIGOS ───────────────────────────────────────────────────

export async function assignWitness(
  witnessUserId: string,
  votingTableId: string,
  isPrimary: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_ASIGNACIONES', 'edit')

    // Verificar que el usuario es TESTIGO
    const user = await db.user.findUnique({
      where: { id: witnessUserId },
      select: { role: true },
    })
    if (!user || user.role !== 'TESTIGO') {
      return { success: false, error: 'El usuario no tiene rol TESTIGO.' }
    }

    // Reasignar una mesa arranca el trámite de cero: si la fila venía RECHAZADA
    // o APROBADA para otra persona, arrastrar ese estado dejaría la mesa
    // contada como descubierta (o como ya aprobada) con un testigo nuevo.
    await db.witnessAssignment.upsert({
      where: { tenantId_votingTableId_isPrimary: { tenantId, votingTableId, isPrimary } },
      update: {
        userId:                 witnessUserId,
        confirmedAt:            null,
        estado:                 'PROPUESTO',
        observacion:            null,
        resueltoAt:             null,
        votingTableIdPropuesto: null,
      },
      create: { tenantId, userId: witnessUserId, votingTableId, isPrimary },
    })

    revalidatePath('/dia-e/sala/asignaciones')
    return { success: true }
  } catch (err) {
    console.error('[assignWitness]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al asignar testigo.' }
  }
}

export async function listWitnessAssignments(filters?: {
  hasWitness?: boolean
}): Promise<WitnessAssignmentView[]> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_ASIGNACIONES')

  // Obtener todas las mesas con sus asignaciones
  const tables = await db.votingTable.findMany({
    include: {
      station: {
        include: { municipality: { include: { department: true } } },
      },
    },
  })

  const assignments = await db.witnessAssignment.findMany({
    where: { tenantId },
  })
  const assignMap = new Map(assignments.map(a => [a.votingTableId + ':' + a.isPrimary, a]))

  // Obtener datos de usuarios
  const userIds = [...new Set(assignments.map(a => a.userId))]
  const users = userIds.length > 0
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true },
      })
    : []
  const userMap = new Map(users.map(u => [u.id, u]))

  const results: WitnessAssignmentView[] = []

  for (const table of tables) {
    const assignment = assignMap.get(table.id + ':true')
    if (filters?.hasWitness === true && !assignment) continue
    if (filters?.hasWitness === false && assignment) continue

    results.push({
      id:            assignment?.id ?? '',
      userId:        assignment?.userId ?? '',
      userEmail:     assignment ? (userMap.get(assignment.userId)?.email ?? '') : '',
      userName:      assignment ? (userMap.get(assignment.userId)?.name ?? null) : null,
      votingTableId: table.id,
      tableNumber:   table.number,
      stationName:   table.station.name,
      municipality:  table.station.municipality.name,
      department:    table.station.municipality.department.name,
      isPrimary:     true,
      confirmedAt:   assignment?.confirmedAt ?? null,
      estado:        assignment?.estado ?? null,
      observacion:   assignment?.observacion ?? null,
      cubierta:      Boolean(assignment) && cubreLaMesa(assignment?.estado),
    })
  }

  return results
}

export async function confirmWitnessAssignment(assignmentId: string): Promise<void> {
  const { db } = await getDbAndSession(['TESTIGO'], 'DIA_E_TESTIGO', 'edit')
  await db.witnessAssignment.update({
    where: { id: assignmentId },
    data:  { confirmedAt: new Date() },
  })
  revalidatePath('/dia-e/testigo')
}

export async function getMyAssignment(): Promise<MyAssignment | null> {
  const { db, tenantId, userId } = await getDbAndSession()

  const assignment = await db.witnessAssignment.findFirst({
    where: { tenantId, userId },
  })
  if (!assignment) return null

  const [table, config] = await Promise.all([
    db.votingTable.findUnique({
      where:   { id: assignment.votingTableId },
      include: {
        station: {
          include: { municipality: { include: { department: true } } },
        },
      },
    }),
    db.tenantConfig.findUnique({
      where:  { tenantId },
      select: { electionOffice: true },
    }),
  ])
  if (!table) return null

  return {
    assignmentId:   assignment.id,
    votingTableId:  table.id,
    tableNumber:    table.number,
    stationName:    table.station.name,
    stationAddress: table.station.address,
    municipality:   table.station.municipality.name,
    department:     table.station.municipality.department.name,
    departmentCode:       table.station.municipality.department.code,
    municipalityDivipola: table.station.municipality.divipola,
    cargo:          config?.electionOffice ?? null,
    isPrimary:      assignment.isPrimary,
    confirmedAt:    assignment.confirmedAt,
  }
}

// ── TRÁMITE ANTE LA REGISTRADURÍA (propuesto → aprobado → corregido) ─────────

/** Junta testigo (User, DB superadmin) con su elector (Voter, DB del tenant) para tener la cédula. */
async function armarListadoPropuesto(
  db: ReturnType<typeof getTenantDb>,
  tenantId: string,
): Promise<{ propuestos: TestigoPropuesto[]; cedulasPorAssignment: Map<string, string> }> {
  const asignaciones = await db.witnessAssignment.findMany({ where: { tenantId } })
  if (asignaciones.length === 0) return { propuestos: [], cedulasPorAssignment: new Map() }

  const [usuarios, mesas] = await Promise.all([
    superadminDb.user.findMany({
      where:  { id: { in: [...new Set(asignaciones.map(a => a.userId))] } },
      select: { id: true, email: true, name: true, voterId: true },
    }),
    db.votingTable.findMany({
      where:   { id: { in: asignaciones.map(a => a.votingTableId) } },
      include: { station: true },
    }),
  ])
  const userMap = new Map(usuarios.map(u => [u.id, u]))
  const mesaMap = new Map(mesas.map(m => [m.id, m]))

  const voterIds = usuarios.map(u => u.voterId).filter((v): v is string => Boolean(v))
  const voters = voterIds.length > 0
    ? await db.voter.findMany({ where: { id: { in: voterIds } }, select: { id: true, cedula: true, cedulaHash: true } })
    : []
  const voterMap = new Map(voters.map(v => [v.id, v]))

  const cedulasPorAssignment = new Map<string, string>()
  const propuestos: TestigoPropuesto[] = asignaciones.map(a => {
    const u     = userMap.get(a.userId)
    const mesa  = mesaMap.get(a.votingTableId)
    const voter = u?.voterId ? voterMap.get(u.voterId) : undefined

    if (voter?.cedula) {
      try { cedulasPorAssignment.set(a.id, decrypt(voter.cedula)) } catch { /* cédula ilegible: se omite */ }
    }

    return {
      assignmentId:  a.id,
      cedulaHash:    voter?.cedulaHash ?? null,
      nombre:        u?.name ?? u?.email ?? '(sin nombre)',
      email:         u?.email ?? '',
      votingTableId: a.votingTableId,
      mesaNumero:    mesa?.number ?? 0,
      puestoNombre:  mesa?.station?.name ?? '',
    }
  })

  return { propuestos, cedulasPorAssignment }
}

/**
 * Listado PROPUESTO para enviar a la Registraduría — incluye la cédula, que es
 * con lo que ellos identifican al testigo. Un testigo sin elector vinculado sale
 * sin cédula y hay que corregirlo antes de radicar.
 */
export async function exportarListadoPropuesto(): Promise<string> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_ASIGNACIONES')
  const { propuestos, cedulasPorAssignment } = await armarListadoPropuesto(db, tenantId)

  const header = 'Cedula,Nombre,Puesto,Mesa,Email'
  const lines = propuestos.map(p =>
    `${cedulasPorAssignment.get(p.assignmentId) ?? ''},"${p.nombre}","${p.puestoNombre}",${p.mesaNumero},"${p.email}"`
  )
  return [header, ...lines].join('\n')
}

/**
 * Lee el archivo APROBADO por la Registraduría (.xlsx o .csv) y lo compara con
 * el propuesto. NO modifica nada: devuelve el diff para revisarlo antes de aplicar.
 */
export async function compararConAprobado(formData: FormData): Promise<
  { success: true; resultado: ResultadoComparacion } | { success: false; error: string }
> {
  try {
    const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_ASIGNACIONES')

    const file = formData.get('archivo') as File | null
    if (!file || file.size === 0) return { success: false, error: 'Selecciona el archivo aprobado.' }

    const libro = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })
    const hoja  = libro.Sheets[libro.SheetNames[0]]
    if (!hoja) return { success: false, error: 'El archivo no tiene ninguna hoja legible.' }

    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' })
    if (filas.length === 0) return { success: false, error: 'El archivo está vacío.' }

    // Los encabezados varían entre archivos oficiales; se buscan por aproximación.
    const leer = (fila: Record<string, unknown>, claves: string[]): string => {
      for (const k of Object.keys(fila)) {
        const norm = k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
        if (claves.some(c => norm.includes(c))) return String(fila[k] ?? '').trim()
      }
      return ''
    }

    const aprobadas: FilaAprobada[] = filas.map(f => ({
      cedula: leer(f, ['cedula', 'documento', 'identificacion']),
      nombre: leer(f, ['nombre', 'testigo']) || undefined,
      puesto: leer(f, ['puesto', 'lugar']) || undefined,
      mesa:   parseInt(leer(f, ['mesa'])) || undefined,
    })).filter(f => f.cedula)

    if (aprobadas.length === 0) {
      return { success: false, error: 'No se encontró una columna de cédula en el archivo.' }
    }

    const { propuestos } = await armarListadoPropuesto(db, tenantId)

    // Índice de mesas del tenant para ubicar la mesa que indica la Registraduría.
    const mesas = await db.votingTable.findMany({ include: { station: true } })
    const resolverMesa = (puesto: string | undefined, mesa: number | undefined) => {
      if (!mesa) return null
      const candidatas = mesas.filter(m => m.number === mesa)
      if (candidatas.length === 0) return null
      const elegida = puesto
        ? candidatas.find(m => m.station.name.toLowerCase().includes(puesto.toLowerCase().trim()))
            ?? (candidatas.length === 1 ? candidatas[0] : null)
        : (candidatas.length === 1 ? candidatas[0] : null)
      return elegida ? { id: elegida.id, numero: elegida.number, puesto: elegida.station.name } : null
    }

    return {
      success: true,
      resultado: compararListados(propuestos, aprobadas, calcularCedulaHash, resolverMesa),
    }
  } catch (err) {
    console.error('[compararConAprobado]', err instanceof Error ? err.message : err)
    return { success: false, error: 'No se pudo leer el archivo. Verifica que sea .xlsx o .csv.' }
  }
}

/**
 * Aplica las correcciones aceptadas: SOLO toca los testigos que cambiaron.
 * Los que quedaron igual se marcan aprobados sin moverlos de mesa.
 */
export async function aplicarCorreccionesRegistraduria(
  cambios: { assignmentId: string; tipo: TipoCambio; votingTableIdAprobado: string | null }[],
): Promise<{ success: boolean; aplicados: number; error?: string }> {
  try {
    const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_ASIGNACIONES', 'edit')
    const ahora = new Date()

    // Todas las asignaciones de una sola vez: antes era un findFirst por testigo
    // dentro del bucle, y el listado de la Registraduría trae cientos de filas.
    const ids = cambios.map(c => c.assignmentId).filter(Boolean)
    if (ids.length === 0) return { success: true, aplicados: 0 }

    const actuales = await db.witnessAssignment.findMany({ where: { id: { in: ids }, tenantId } })
    const porId = new Map(actuales.map(a => [a.id, a]))

    // Los que quedan igual y los rechazados reciben datos idénticos: van en dos
    // updateMany. Solo los movidos de mesa necesitan un update propio, porque
    // cada uno guarda su mesa anterior.
    const sinCambio:  string[] = []
    const rechazados: string[] = []
    const movidos: ReturnType<typeof db.witnessAssignment.update>[] = []

    for (const c of cambios) {
      const actual = porId.get(c.assignmentId)
      if (!actual) continue

      if (c.tipo === 'SIN_CAMBIO') {
        sinCambio.push(actual.id)
      } else if (c.tipo === 'RECHAZADO') {
        rechazados.push(actual.id)
      } else if (c.tipo === 'MESA_CAMBIADA' && c.votingTableIdAprobado) {
        movidos.push(db.witnessAssignment.update({
          where: { id: actual.id },
          data: {
            estado:                 'APROBADO',
            votingTableIdPropuesto: actual.votingTableIdPropuesto ?? actual.votingTableId,
            votingTableId:          c.votingTableIdAprobado,
            resueltoAt:             ahora,
          },
        }))
      }
    }

    // Todo o nada: esto asienta la respuesta oficial de la Registraduría. A
    // medio aplicar, la campaña no sabría qué testigos quedaron en firme.
    await db.$transaction([
      ...(sinCambio.length > 0 ? [db.witnessAssignment.updateMany({
        where: { id: { in: sinCambio }, tenantId },
        data:  { estado: 'APROBADO', resueltoAt: ahora },
      })] : []),
      ...(rechazados.length > 0 ? [db.witnessAssignment.updateMany({
        where: { id: { in: rechazados }, tenantId },
        data: {
          estado:      'RECHAZADO',
          observacion: 'No apareció en el listado aprobado por la Registraduría.',
          resueltoAt:  ahora,
        },
      })] : []),
      ...movidos,
    ])

    revalidatePath('/dia-e/sala/asignaciones')
    return { success: true, aplicados: sinCambio.length + rechazados.length + movidos.length }
  } catch (err) {
    console.error('[aplicarCorreccionesRegistraduria]', err instanceof Error ? err.message : err)

    // Dos testigos no pueden quedar en la misma mesa (índice único mesa+principal).
    // Pasa cuando la Registraduría mueve a alguien a una mesa ya ocupada: sin
    // decirlo, el admin solo ve "no se pudo" y no sabe qué corregir.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return {
        success: false, aplicados: 0,
        error: 'Dos testigos quedarían en la misma mesa. Revisa las mesas de destino del archivo aprobado: no se aplicó ningún cambio.',
      }
    }
    return { success: false, aplicados: 0, error: 'No se pudieron aplicar las correcciones.' }
  }
}

// ── TRANSMISIÓN E-14 ─────────────────────────────────────────────────────────

/** Transmite datos manuales del E-14, incluido el bloque de nivelación de la mesa. */
export async function submitManualE14(
  votingTableId: string,
  votes: { candidateId: string; votes: number }[],
  actaTotal: number,
  nivelacion?: { e11: number; urna: number; incinerados: number },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { db, tenantId, userId } = await getDbAndSession(['TESTIGO'], 'DIA_E_TESTIGO', 'edit')

    // Verificar que el testigo está asignado a esta mesa
    const assignment = await db.witnessAssignment.findFirst({
      where: { tenantId, userId, votingTableId },
    })
    if (!assignment) {
      return { success: false, error: 'No estás asignado a esta mesa.' }
    }

    const manualTotal = votes.reduce((sum, v) => sum + v.votes, 0)

    const datosNivelacion = nivelacion
      ? {
          nivelacionE11:         nivelacion.e11,
          nivelacionUrna:        nivelacion.urna,
          nivelacionIncinerados: nivelacion.incinerados,
        }
      : {}

    // Upsert atómico, no findUnique+create: el testigo manda foto y manual casi
    // a la vez y las dos escrituras compiten por la misma fila. Con el chequeo
    // previo, ambas ven "no existe" y la segunda choca contra el índice único
    // de votingTableId — justo cuando el acta ya no se puede volver a digitar.
    const datosManual = {
      manualData:        votes,
      manualTotal:       actaTotal,
      manualSubmittedAt: new Date(),
      ...datosNivelacion,
    }
    await db.e14Transmission.upsert({
      where:  { votingTableId },
      update: datosManual,
      create: { tenantId, votingTableId, witnessUserId: userId, ...datosManual },
    })

    await runVerification(votingTableId, db)

    revalidatePath('/dia-e/testigo')
    revalidatePath('/dia-e/sala')
    return { success: true }
  } catch (err) {
    console.error('[submitManualE14]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al transmitir datos.' }
  }
}

/** Procesa la foto del E-14 — descarga server-side, envía a ambas IAs en paralelo */
export async function submitPhotoE14(
  votingTableId: string,
  photoUrl: string,
): Promise<{
  success: boolean
  extractedData?: { candidateId: string; votes: number }[]
  confidence?: string
  discrepancies?: string[]
  error?: string
}> {
  try {
    const { db, tenantId, userId } = await getDbAndSession(['TESTIGO'], 'DIA_E_TESTIGO', 'edit')

    // Verificar asignación
    const assignment = await db.witnessAssignment.findFirst({
      where: { tenantId, userId, votingTableId },
    })
    if (!assignment) {
      return { success: false, error: 'No estás asignado a esta mesa.' }
    }

    // Descargar imagen desde Vercel Blob — server-side
    const imageResponse = await fetch(photoUrl)
    if (!imageResponse.ok) {
      return { success: false, error: 'No se pudo descargar la imagen.' }
    }
    const arrayBuffer = await imageResponse.arrayBuffer()
    const base64      = Buffer.from(arrayBuffer).toString('base64')
    const mimeType    = imageResponse.headers.get('content-type') ?? 'image/jpeg'

    // Llamar a ambas IAs en paralelo con la clave propia del tenant si la tiene.
    // Cuando no la tiene se pasa undefined y el cliente cae a la clave global
    // del sistema por defecto — que es lo que promete la pantalla de
    // Configuración ("si no configuras ninguna, la campaña usa las claves
    // globales"). Si no hay ninguna de las dos, el cliente lanza y se degrada
    // a una sola fuente o a captura manual, como ya sabe hacer el resto.
    const { groq: groqKey, zhipu: zhipuKey, mistral: mistralKey } = await getTenantAiKeys(tenantId)
    const [groqCrudo, zhipuCrudo] = await Promise.all([
      extractE14WithGroq(base64, mimeType, groqKey).catch(err => {
        console.error('[Groq E14]', err instanceof Error ? err.message : err)
        return null
      }),
      extractE14WithZhipu(base64, mimeType, zhipuKey).catch(err => {
        console.error('[Zhipu E14]', err instanceof Error ? err.message : err)
        return null
      }),
    ])

    // Una respuesta SIN candidatos no es una lectura. Los clientes devuelven el
    // objeto igual cuando el JSON no parsea, así que una respuesta ilegible se
    // veía como lectura válida — y en la rama de confianza BAJA el consenso toma
    // la primera como primaria, borrando la lectura buena de la otra IA.
    const conCandidatos = (r: E14Lectura | null) => (r && r.candidatos.length > 0 ? r : null)
    const groqResult  = conCandidatos(groqCrudo)
    const zhipuResult = conCandidatos(zhipuCrudo)

    // RESPALDO. Si una de las dos principales falló, el acta se quedaría con una
    // sola lectura y sin nada contra qué compararla. Mistral entra a ocupar ese
    // lugar para que el consenso siga siendo de dos. No se llama si las dos
    // respondieron: es respaldo, no una tercera opinión permanente.
    let mistralCrudo = null
    if (!groqResult || !zhipuResult) {
      mistralCrudo = await extractE14WithMistral(base64, mimeType, mistralKey).catch(err => {
        console.error('[Mistral E14 respaldo]', err instanceof Error ? err.message : err)
        return null
      })
    }
    const mistralResult = conCandidatos(mistralCrudo)

    // Las lecturas que sirvieron, en orden de preferencia.
    const lecturas = [groqResult, zhipuResult, mistralResult].filter(r => r !== null)

    // Si ninguna IA respondió
    if (lecturas.length === 0) {
      // Guardar solo la foto — la imagen del acta no se pierde aunque la IA falle.
      const soloFoto = { photoUrl, photoSubmittedAt: new Date() }
      await db.e14Transmission.upsert({
        where:  { votingTableId },
        update: soloFoto,
        create: { tenantId, votingTableId, witnessUserId: userId, ...soloFoto },
      })
      return { success: false, error: 'No se pudo procesar la imagen. Digita los datos manualmente.' }
    }

    // Consenso con dos lecturas; si solo hubo una (falló una principal Y el
    // respaldo), se usa esa sola y la confianza baja a MEDIA.
    let confidence: string
    let discrepanciesArr: string[]
    let leidos: { numero: number | null; nombre: string; votos: number | null }[]
    let actaMesaNumero: string | null
    let actaPuestoNombre: string | null

    if (lecturas.length >= 2) {
      const consenso = consensoE14(lecturas[0], lecturas[1])
      leidos           = consenso.data.candidatos
      confidence       = consenso.confidence
      discrepanciesArr = consenso.discrepancies
      actaMesaNumero   = consenso.data.mesaNumero
      actaPuestoNombre = consenso.data.puestoNombre
    } else {
      leidos           = lecturas[0].candidatos
      confidence       = 'MEDIA'
      discrepanciesArr = []
      actaMesaNumero   = lecturas[0].mesaNumero
      actaPuestoNombre = lecturas[0].puestoNombre
    }

    // La IA devuelve lo impreso en el acta; el testigo y la Registraduría mandan
    // Candidate.id. Se traduce ACÁ, al escribir, para que las tres fuentes
    // queden con la misma llave y la verificación pueda cruzarlas. Se pasa el
    // número del renglón porque es el cruce firme: los modelos coinciden en el
    // número y difieren en cómo escriben el nombre.
    const candidatosTenant = await db.candidate.findMany({
      where:  { tenantId },
      select: { id: true, name: true, order: true },
    })
    let extractedData = normalizarClavesE14(
      leidos
        .filter(c => c.votos !== null)
        .map(c => ({ candidateId: c.nombre, votes: c.votos!, numero: c.numero })),
      candidatosTenant,
    )

    const extractedTotal = extractedData.reduce((sum, v) => sum + v.votes, 0)

    // Guardar en DB
    const photoData = {
      photoUrl,
      extractedData,
      extractedTotal,
      extractionConfidence: confidence,
      // El número impreso en el acta. Es la única evidencia de QUÉ papel se
      // fotografió: sin esto, un acta de otra mesa entra sin dejar rastro.
      actaMesaNumero,
      // …y el puesto, porque el número de mesa se repite entre puestos.
      actaPuestoNombre,
      // Auditoría: se guarda la respuesta CRUDA, incluso la que no se pudo
      // parsear — es justo la que hay que poder mirar cuando algo salió mal.
      groqResult:           groqCrudo ? { rawResponse: groqCrudo.rawResponse } : Prisma.DbNull,
      zhipuResult:          zhipuCrudo ? { rawResponse: zhipuCrudo.rawResponse } : Prisma.DbNull,
      mistralResult:        mistralCrudo ? { rawResponse: mistralCrudo.rawResponse } : Prisma.DbNull,
      discrepancies:        discrepanciesArr.length > 0 ? discrepanciesArr : Prisma.DbNull,
      photoSubmittedAt:     new Date(),
    }

    await db.e14Transmission.upsert({
      where:  { votingTableId },
      update: photoData,
      create: { tenantId, votingTableId, witnessUserId: userId, ...photoData },
    })

    await runVerification(votingTableId, db)

    revalidatePath('/dia-e/testigo')
    revalidatePath('/dia-e/sala')
    return { success: true, extractedData, confidence, discrepancies: discrepanciesArr }
  } catch (err) {
    console.error('[submitPhotoE14]', err instanceof Error ? err.message : err)
    return { success: false, error: 'Error al procesar la foto.' }
  }
}

/** Función interna de verificación cruzada — NO exportar */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
/**
 * Cruza las TRES fuentes obligatorias (manual, foto, Registraduría) candidato
 * por candidato. Ver lib/verificacion-e14.ts para las reglas y su chequeo.
 */
async function runVerification(votingTableId: string, db: any): Promise<void> {
  const tx = await db.e14Transmission.findUnique({ where: { votingTableId } })
  if (!tx) return

  const resultado = verificarTresFuentes({
    manual:        tx.manualSubmittedAt ? (tx.manualData as VotoPorCandidato[] | null) : null,
    foto:          tx.photoSubmittedAt  ? (tx.extractedData as VotoPorCandidato[] | null) : null,
    registraduria: tx.registraduriaAt   ? (tx.registraduriaData as VotoPorCandidato[] | null) : null,
  })

  await db.e14Transmission.update({
    where: { votingTableId },
    data: {
      verificationStatus: resultado.estado,
      discrepancies:      resultado.discrepancias.length > 0 ? resultado.discrepancias : Prisma.DbNull,
      finalData:          resultado.datosFinales ?? Prisma.DbNull,
      finalizedAt:        resultado.datosFinales ? new Date() : null,
    },
  })
}

/**
 * Registra la tercera fuente: los votos publicados por la Registraduría para
 * una mesa. `fuente` distingue si vino del scraping automático o se cargó a
 * mano — se guarda para poder auditar de dónde salió cada cifra.
 */
export async function registrarDatosRegistraduria(
  votingTableId: string,
  votos: { candidateId: string; votes: number }[],
  fuente: 'SCRAPING' | 'CARGA_MANUAL' = 'CARGA_MANUAL',
): Promise<{ success: boolean; estado?: string; error?: string }> {
  try {
    const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_SALA', 'edit')

    const existente = await db.e14Transmission.findUnique({ where: { votingTableId } })
    if (!existente || existente.tenantId !== tenantId) {
      return { success: false, error: 'Esa mesa todavía no tiene transmisión del testigo.' }
    }

    await db.e14Transmission.update({
      where: { votingTableId },
      data: {
        registraduriaData:   votos,
        registraduriaTotal:  votos.reduce((s, v) => s + v.votes, 0),
        registraduriaAt:     new Date(),
        registraduriaFuente: fuente,
      },
    })

    await runVerification(votingTableId, db)
    const actualizado = await db.e14Transmission.findUnique({ where: { votingTableId } })

    revalidatePath('/dia-e/sala')
    return { success: true, estado: actualizado?.verificationStatus }
  } catch (err) {
    console.error('[registrarDatosRegistraduria]', err instanceof Error ? err.message : err)
    return { success: false, error: 'No se pudieron registrar los datos de la Registraduría.' }
  }
}

export interface MesaEnDisputa {
  votingTableId: string
  tableNumber:   number
  stationName:   string
  resumen:       string
  discrepancias: {
    candidateId: string
    candidateName: string
    valores: Record<string, number>
    diferencia: number
  }[]
}

/** Mesas cuyas fuentes no cuadran — candidatas a demanda. */
export async function getMesasEnDisputa(): Promise<MesaEnDisputa[]> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_SALA')

  const txs = await db.e14Transmission.findMany({
    where: { tenantId, verificationStatus: 'DISCREPANCIA' },
  })
  if (txs.length === 0) return []

  const [mesas, candidatos] = await Promise.all([
    db.votingTable.findMany({
      where:   { id: { in: txs.map(t => t.votingTableId) } },
      include: { station: true },
    }),
    db.candidate.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ])
  const mesaMap = new Map(mesas.map(m => [m.id, m]))
  const nombreCand = new Map(candidatos.map(c => [c.id.toLowerCase(), c.name]))

  return txs.map(tx => {
    const mesa = mesaMap.get(tx.votingTableId)
    const difs = (tx.discrepancies ?? []) as {
      candidateId: string; valores: Record<string, number>; diferencia: number
    }[]
    return {
      votingTableId: tx.votingTableId,
      tableNumber:   mesa?.number ?? 0,
      stationName:   mesa?.station?.name ?? '',
      resumen:       `${difs.length} candidato(s) no cuadran`,
      discrepancias: difs.map(d => ({
        candidateId:   d.candidateId,
        candidateName: nombreCand.get(d.candidateId.toLowerCase())
          ?? (d.candidateId === 'votos_blanco' ? 'Votos en blanco'
            : d.candidateId === 'votos_nulos' ? 'Votos nulos' : d.candidateId),
        valores:    d.valores,
        diferencia: d.diferencia,
      })),
    }
  })
}

/** Estado completo de transmisión para una mesa */
export async function getTransmissionStatus(votingTableId: string): Promise<TransmissionDetail | null> {
  const { db, tenantId } = await getDbAndSession()

  const tx = await db.e14Transmission.findUnique({ where: { votingTableId } })
  if (!tx || tx.tenantId !== tenantId) return null

  const user = await db.user.findUnique({
    where: { id: tx.witnessUserId },
    select: { email: true },
  })

  const [table, candidatos] = await Promise.all([
    db.votingTable.findUnique({
      where:   { id: votingTableId },
      include: { station: true },
    }),
    db.candidate.findMany({
      where:   { tenantId },
      select:  { id: true, name: true },
      orderBy: { order: 'asc' },
    }),
  ])

  return {
    candidatos,
    id:                   tx.id,
    votingTableId:        tx.votingTableId,
    tableNumber:          table?.number ?? 0,
    stationName:          table?.station.name ?? '',
    witnessEmail:         user?.email ?? '',
    verificationStatus:   tx.verificationStatus,
    manualData:           tx.manualData as { candidateId: string; votes: number }[] | null,
    manualTotal:          tx.manualTotal,
    extractedData:        tx.extractedData as { candidateId: string; votes: number }[] | null,
    extractedTotal:       tx.extractedTotal,
    extractionConfidence: tx.extractionConfidence,
    registraduriaData:    tx.registraduriaData as { candidateId: string; votes: number }[] | null,
    registraduriaTotal:   tx.registraduriaTotal,
    registraduriaAt:      tx.registraduriaAt,
    registraduriaFuente:  tx.registraduriaFuente,
    discrepancias:        tx.discrepancies as TransmissionDetail['discrepancias'],
    finalData:            tx.finalData as { candidateId: string; votes: number }[] | null,
    photoUrl:             tx.photoUrl,
    notes:                tx.notes,
    manualSubmittedAt:    tx.manualSubmittedAt,
    photoSubmittedAt:     tx.photoSubmittedAt,
    // groqResult y zhipuResult NUNCA se retornan — solo auditoría
  }
}

/** Lista de transmisiones para la sala de situación */
export async function listTransmissions(filters?: {
  verificationStatus?: string
}): Promise<TransmissionView[]> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_SALA')

  const where: Record<string, unknown> = { tenantId }
  if (filters?.verificationStatus) {
    where.verificationStatus = filters.verificationStatus
  }

  const transmissions = await db.e14Transmission.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })

  // Obtener info de mesas y testigos
  const tableIds = transmissions.map((t: { votingTableId: string }) => t.votingTableId)
  const userIds  = [...new Set(transmissions.map((t: { witnessUserId: string }) => t.witnessUserId))]

  const [tables, users, candidates] = await Promise.all([
    tableIds.length > 0
      ? db.votingTable.findMany({
          where: { id: { in: tableIds } },
          include: { station: true },
        })
      : [],
    userIds.length > 0
      ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
      : [],
    db.candidate.findMany({ where: { tenantId, isOwn: true }, select: { id: true, name: true } }),
  ])

  const tableMap = new Map(tables.map((t: { id: string; number: number; station: { name: string } }) => [t.id, t]))
  const userMap  = new Map(users.map((u: { id: string; email: string }) => [u.id, u]))
  // ponytail: desde normalizarClavesE14 (ver submitPhotoE14) la foto ya se
  // guarda con Candidate.id, así que aceptar el nombre solo sirve para las
  // transmisiones escritas ANTES de esa corrección. Quitar cuando no queden.
  const clavesPropias = new Set<string>()
  for (const c of candidates as { id: string; name: string }[]) {
    clavesPropias.add(c.id.toLowerCase())
    clavesPropias.add(c.name.toLowerCase())
  }

  return transmissions.map((tx: {
    id: string; votingTableId: string; witnessUserId: string
    verificationStatus: string; finalData: unknown; manualData: unknown
    extractedData: unknown; extractionConfidence: string | null
    manualSubmittedAt: Date | null; photoSubmittedAt: Date | null; photoUrl: string | null
    registraduriaAt: Date | null; actaMesaNumero: string | null
    actaPuestoNombre: string | null
  }) => {
    const table = tableMap.get(tx.votingTableId)
    const user  = userMap.get(tx.witnessUserId)

    // Calcular votos del candidato propio
    let ownVotes: number | null = null
    const data = (tx.finalData ?? tx.manualData ?? tx.extractedData) as
      { candidateId: string; votes: number }[] | null
    if (data) {
      for (const v of data) {
        if (clavesPropias.has(v.candidateId.toLowerCase())) {
          ownVotes = (ownVotes ?? 0) + v.votes
        }
      }
    }

    // Se compara acá y no se guarda como bandera: la mesa y el puesto viven en
    // votingTable y una bandera duplicada quedaría desactualizada.
    const coincideMesa   = table ? actaEsDeLaMesa(tx.actaMesaNumero, table.number) : null
    const coincidePuesto = table ? actaEsDelPuesto(tx.actaPuestoNombre, table.station?.name ?? '') : null
    const desajustes: string[] = []
    if (coincideMesa === false)   desajustes.push(`mesa ${tx.actaMesaNumero}`)
    if (coincidePuesto === false) desajustes.push(`puesto ${tx.actaPuestoNombre}`)

    return {
      id:                   tx.id,
      votingTableId:        tx.votingTableId,
      tableNumber:          table?.number ?? 0,
      stationName:          table?.station?.name ?? '',
      witnessEmail:         user?.email ?? '',
      verificationStatus:   tx.verificationStatus,
      ownCandidateVotes:    ownVotes,
      transmittedAt:        tx.manualSubmittedAt ?? tx.photoSubmittedAt,
      hasManual:            !!tx.manualData,
      hasPhoto:             !!tx.photoUrl,
      hasRegistraduria:     !!tx.registraduriaAt,
      extractionConfidence: tx.extractionConfidence,
      actaMesaNumero:       tx.actaMesaNumero,
      actaPuestoNombre:     tx.actaPuestoNombre,
      actaCruzada:          esActaCruzada(coincideMesa, coincidePuesto),
      actaCruzadaDetalle:   desajustes.length > 0 ? desajustes.join(', ') : null,
    }
  })
}

/**
 * Acta cruzada = alguno de los chequeos dijo que NO. Si ninguno se pudo hacer
 * queda en null: "no se sabe" no es lo mismo que "está bien".
 */
function esActaCruzada(...chequeos: (boolean | null)[]): boolean | null {
  if (chequeos.includes(false)) return true
  if (chequeos.every(c => c === null)) return null
  return false
}

// ── INCIDENTES ───────────────────────────────────────────────────────────────

export async function reportIncident(data: {
  votingTableId?: string
  type:        string
  description: string
  severity:    string
  photoUrl?:   string
}): Promise<{ success: boolean }> {
  try {
    const { db, tenantId, userId } = await getDbAndSession()
    await db.incident.create({
      data: {
        tenantId,
        reportedBy:    userId,
        votingTableId: data.votingTableId ?? null,
        type:          data.type,
        description:   data.description,
        severity:      data.severity,
        photoUrl:      data.photoUrl ?? null,
      },
    })
    revalidatePath('/dia-e/sala/incidentes')
    return { success: true }
  } catch (err) {
    console.error('[reportIncident]', err instanceof Error ? err.message : err)
    return { success: false }
  }
}

export async function listIncidents(filters?: {
  status?: string; severity?: string; type?: string
}): Promise<IncidentView[]> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_INCIDENTES')

  const where: Record<string, unknown> = { tenantId }
  if (filters?.status) where.status = filters.status
  if (filters?.severity) where.severity = filters.severity
  if (filters?.type) where.type = filters.type

  const incidents = await db.incident.findMany({
    where,
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
  })

  const userIds = [...new Set(incidents.map((i: { reportedBy: string }) => i.reportedBy))]
  const users = userIds.length > 0
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
    : []
  const userMap = new Map(users.map((u: { id: string; email: string }) => [u.id, u.email]))

  return incidents.map((i: {
    id: string; reportedBy: string; votingTableId: string | null
    type: string; description: string; severity: string
    photoUrl: string | null; status: string; createdAt: Date
  }) => ({
    ...i,
    reporterEmail: userMap.get(i.reportedBy) ?? '',
  }))
}

export async function updateIncidentStatus(
  id: string,
  status: string,
): Promise<void> {
  const { db } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_INCIDENTES', 'edit')
  await db.incident.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === 'RESUELTO' ? new Date() : null,
    },
  })
  revalidatePath('/dia-e/sala/incidentes')
}

// ── RESULTADOS AGREGADOS ─────────────────────────────────────────────────────

/**
 * Agrega los votos de todas las mesas que ya reportaron algo, con la fuente más
 * confiable disponible: finalData (las tres coinciden) > manual > foto.
 *
 * Se agrega EN VIVO a propósito: la Registraduría publica horas después y el
 * conteo propio tiene que ir subiendo con cada mesa que transmite el testigo.
 * La confianza de cada cifra se lee aparte, en el estado de verificación.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function agregarResultados(db: any, tenantId: string): Promise<ElectionResultView[]> {
  const [candidates, transmissions, totalTables] = await Promise.all([
    db.candidate.findMany({ where: { tenantId }, orderBy: { order: 'asc' } }),
    db.e14Transmission.findMany({ where: { tenantId } }),
    db.votingTable.count(),
  ])

  // Agregar votos por candidato
  const votesByCand = new Map<string, number>()
  let totalAllVotes = 0
  let tablesReported = 0

  for (const tx of transmissions) {
    const data = (tx.finalData ?? tx.manualData ?? tx.extractedData) as
      { candidateId: string; votes: number }[] | null
    if (!data) continue
    tablesReported++
    for (const v of data) {
      const key = v.candidateId.toLowerCase()
      votesByCand.set(key, (votesByCand.get(key) ?? 0) + v.votes)
      totalAllVotes += v.votes
    }
  }

  return candidates.map((c: { id: string; name: string; party: string | null; isOwn: boolean }) => {
    // ponytail: igual que en listTransmissions — sumar también por nombre solo
    // cubre transmisiones anteriores a normalizarClavesE14. Quitar cuando no queden.
    const votes = (votesByCand.get(c.id.toLowerCase()) ?? 0)
                + (votesByCand.get(c.name.toLowerCase()) ?? 0)
    return {
      candidateId:   c.id,
      candidateName: c.name,
      party:         c.party,
      isOwn:         c.isOwn,
      totalVotes:    votes,
      tableCount:    tablesReported,
      totalTables,
      percentage:    totalAllVotes > 0 ? Math.round((votes / totalAllVotes) * 1000) / 10 : 0,
    }
  })
}

export async function getElectionResults(): Promise<ElectionResultView[]> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_RESULTADOS')
  return agregarResultados(db, tenantId)
}

/** Mismo agregado, pero para la sala de situación (otro permiso de pantalla). */
export async function getResultadosEnVivo(): Promise<ElectionResultView[]> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_SALA')
  return agregarResultados(db, tenantId)
}

export async function getDashboardDiaE(): Promise<DashboardDiaE> {
  const { db, tenantId } = await getDbAndSession(['ADMIN_CAMPANA', 'COORDINADOR'], 'DIA_E_SALA')

  const [
    mesasTotales,
    mesasConTestigo,
    transmissions,
    incidentesAlta,
    incidentesMedia,
    incidentesBaja,
  ] = await Promise.all([
    db.votingTable.count(),
    // Equivalente en consulta de cubreLaMesa() — ver _lib/registraduria.ts.
    db.witnessAssignment.count({ where: { tenantId, isPrimary: true, estado: { not: 'RECHAZADO' } } }),
    db.e14Transmission.findMany({
      where:  { tenantId },
      select: { verificationStatus: true },
    }),
    db.incident.count({ where: { tenantId, status: 'ABIERTO', severity: 'ALTA' } }),
    db.incident.count({ where: { tenantId, status: 'ABIERTO', severity: 'MEDIA' } }),
    db.incident.count({ where: { tenantId, status: 'ABIERTO', severity: 'BAJA' } }),
  ])

  const statusCounts = new Map<string, number>()
  for (const tx of transmissions) {
    statusCounts.set(tx.verificationStatus, (statusCounts.get(tx.verificationStatus) ?? 0) + 1)
  }

  const mesasTransmitidas = transmissions.length
  const mesasVerificadas  = statusCounts.get('VERIFICADO') ?? 0
  const mesasDisputa      = statusCounts.get('DISCREPANCIA') ?? 0
  const mesasIncompletas  = statusCounts.get('INCOMPLETA') ?? 0

  return {
    mesasTotales,
    mesasConTestigo,
    mesasTransmitidas,
    mesasVerificadas,
    mesasDisputa,
    mesasIncompletas,
    mesasSinReportar: mesasTotales - mesasTransmitidas,
    incidentesAlta,
    incidentesMedia,
    incidentesBaja,
  }
}
