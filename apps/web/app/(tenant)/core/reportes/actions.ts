'use server'

import { getTenantDb } from '@vectra/db'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { puntoEnPoligono } from '@/lib/geometry'
import { compromisosParaMeta, leerTasaFuga } from '@/lib/meta-votos'
import { titulosDe, TITULOS } from '@/lib/lideres'
import { CLAVE_BLANCO, CLAVE_NULOS, datosDeTransmision, votosDeE14, totalVotos, type Votos } from '@/lib/escrutinio'
import { consolidarE14, type ConsolidadoE14 } from '@/lib/consolidado-escrutinio'

type Celda = string | number

export interface Reporte {
  titulo:      string
  descripcion: string
  columnas:    string[]
  filas:       Celda[][]
  totales?:    Celda[]
}

const ETIQUETA_ESTADO: Record<string, string> = {
  SIN_CONTACTAR: 'Sin contactar', CONTACTADO: 'Contactado', SIMPATIZANTE: 'Simpatizante',
  COMPROMETIDO: 'Comprometido', VOTO_SEGURO: 'Voto seguro',
}
const esComprometido = (estado: string) => estado === 'COMPROMETIDO' || estado === 'VOTO_SEGURO'
const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0)

async function contexto() {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_REPORTES')
  const tenantId = session.user.tenantId
  return { db: getTenantDb(await getTenantConnection(tenantId)), tenantId, modulos: session.user.activeModules }
}
type Db = Awaited<ReturnType<typeof contexto>>['db']

export async function getReporte(id: string): Promise<Reporte | null> {
  const { db, tenantId, modulos } = await contexto()
  switch (id) {
    case 'lideres':    return reporteLideres(db, tenantId)
    case 'compromiso': return reporteCompromiso(db, tenantId)
    case 'metas':      return reporteMetas(db, tenantId)
    case 'puestos':    return reportePuestos(db, tenantId)
    case 'mesas':      return reporteMesas(db, tenantId)
    case 'calidad':    return reporteCalidad(db, tenantId)
    case 'testigos':   return modulos.includes('DIA_E') ? reporteTestigos(db, tenantId) : null
    case 'preconteo':  return modulos.includes('DIA_E') ? reportePreconteo(db, tenantId) : null
    case 'e24':        return modulos.includes('DIA_E') ? reporteE24(db, tenantId) : null
    default:           return null
  }
}

async function reporteLideres(db: Db, tenantId: string): Promise<Reporte> {
  const todos = await db.voter.findMany({ where: { tenantId }, select: { id: true, name: true, leaderId: true, commitmentStatus: true } })
  const porId = new Map(todos.map((v) => [v.id, v]))
  const hijos = new Map<string, typeof todos>()
  for (const v of todos) if (v.leaderId) hijos.set(v.leaderId, [...(hijos.get(v.leaderId) ?? []), v])

  const memo = new Map<string, { red: number; comprometidos: number }>()
  function red(id: string): { red: number; comprometidos: number } {
    const m = memo.get(id); if (m) return m
    memo.set(id, { red: 0, comprometidos: 0 }) // corta ciclos
    let total = 0, comp = 0
    for (const h of hijos.get(id) ?? []) {
      const sub = red(h.id)
      total += 1 + sub.red
      comp  += (esComprometido(h.commitmentStatus) ? 1 : 0) + sub.comprometidos
    }
    const r = { red: total, comprometidos: comp }
    memo.set(id, r)
    return r
  }

  const filas = [...hijos.keys()]
    .map((id) => {
      const v = porId.get(id); if (!v) return null
      const directos = hijos.get(id)!.length
      const r = red(id)
      return [v.name, v.leaderId ? porId.get(v.leaderId)?.name ?? '' : '—', directos, r.red, r.comprometidos,
        titulosDe(directos, r.red).map((t) => TITULOS[t].nombre).join(', ') || '—'] as Celda[]
    })
    .filter((f): f is Celda[] => f !== null)
    .sort((a, b) => (b[3] as number) - (a[3] as number))

  return {
    titulo: 'Red por líder',
    descripcion: 'Toda persona con al menos una persona a cargo. "Red" cuenta a cualquier profundidad.',
    columnas: ['Líder', 'Reporta a', 'Directos', 'Red completa', 'Comprometidos en la red', 'Títulos'],
    filas,
  }
}

async function reporteCompromiso(db: Db, tenantId: string): Promise<Reporte> {
  const grupos = await db.voter.groupBy({ by: ['commitmentStatus'], where: { tenantId }, _count: true })
  const total = grupos.reduce((a, g) => a + g._count, 0)
  const cuenta = new Map(grupos.map((g) => [g.commitmentStatus as string, g._count]))
  return {
    titulo: 'Estado de compromiso',
    descripcion: `${total} electores en la campaña.`,
    columnas: ['Estado', 'Electores', '%'],
    filas: Object.keys(ETIQUETA_ESTADO).map((e) => [ETIQUETA_ESTADO[e], cuenta.get(e) ?? 0, `${pct(cuenta.get(e) ?? 0, total)} %`]),
    totales: ['Total', total, '100 %'],
  }
}

async function reporteMetas(db: Db, tenantId: string): Promise<Reporte> {
  const [zonas, votantes, tasaFuga] = await Promise.all([
    db.commune.findMany({ where: { metaVotos: { not: null } }, select: { name: true, type: true, metaVotos: true, boundary: true } }),
    db.voter.findMany({ where: { tenantId, lat: { not: null }, lng: { not: null } }, select: { lat: true, lng: true, commitmentStatus: true } }),
    leerTasaFuga(db, tenantId),
  ])
  let meta = 0, necesarios = 0, registrados = 0, comprometidos = 0
  const filas = zonas
    .map((z) => {
      const borde = z.boundary as [number, number][] | null
      const dentro = borde ? votantes.filter((v) => puntoEnPoligono([v.lat!, v.lng!], borde)) : []
      const comp = dentro.filter((v) => esComprometido(v.commitmentStatus)).length
      const nec = compromisosParaMeta(z.metaVotos!, tasaFuga)
      meta += z.metaVotos!; necesarios += nec; registrados += dentro.length; comprometidos += comp
      return [z.name, z.type === 'COMUNA' ? 'Comuna' : 'Corregimiento', z.metaVotos!, nec, dentro.length, comp,
        `${pct(comp, nec)} %`, Math.max(0, nec - comp)] as Celda[]
    })
    .sort((a, b) => (b[2] as number) - (a[2] as number))
  return {
    titulo: 'Avance de metas por comuna',
    descripcion: 'Avance = comprometidos + voto seguro que viven en la zona (electores ubicados en el mapa) sobre los compromisos que pide la meta descontando la fuga. La meta se edita en Territorio.',
    columnas: ['Zona', 'Tipo', 'Meta de votos', 'Compromisos necesarios', 'Registrados', 'Comprometidos', 'Avance', 'Faltan'],
    filas,
    totales: ['Total', '', meta, necesarios, registrados, comprometidos, `${pct(comprometidos, necesarios)} %`, Math.max(0, necesarios - comprometidos)],
  }
}

async function reportePuestos(db: Db, tenantId: string): Promise<Reporte> {
  const [puestos, votantes, testigos] = await Promise.all([
    db.votingStation.findMany({ select: { id: true, name: true, address: true, tables: { select: { id: true } } } }),
    db.voter.findMany({ where: { tenantId, votingTableId: { not: null } }, select: { commitmentStatus: true, votingTable: { select: { stationId: true } } } }),
    db.witnessAssignment.findMany({ where: { tenantId }, select: { votingTableId: true } }),
  ])
  const conTestigo = new Set(testigos.map((t) => t.votingTableId))
  const porPuesto = new Map<string, { electores: number; comp: number }>()
  for (const v of votantes) {
    const id = v.votingTable!.stationId
    const r = porPuesto.get(id) ?? { electores: 0, comp: 0 }
    r.electores++; if (esComprometido(v.commitmentStatus)) r.comp++
    porPuesto.set(id, r)
  }
  const tot = { mesas: 0, electores: 0, comp: 0, testigo: 0 }
  const filas = puestos
    .filter((p) => porPuesto.has(p.id))
    .map((p) => {
      const r = porPuesto.get(p.id)!
      const cubiertas = p.tables.filter((t) => conTestigo.has(t.id)).length
      tot.mesas += p.tables.length; tot.electores += r.electores; tot.comp += r.comp; tot.testigo += cubiertas
      return [p.name, p.address.split(',')[0], p.tables.length, r.electores, r.comp, `${cubiertas} de ${p.tables.length}`] as Celda[]
    })
    .sort((a, b) => (b[3] as number) - (a[3] as number))
  return {
    titulo: 'Electores por puesto de votación',
    descripcion: 'Solo puestos donde vota al menos uno de nuestros electores (según su mesa asignada o el censo).',
    columnas: ['Puesto', 'Zona', 'Mesas', 'Electores', 'Comprometidos', 'Mesas con testigo'],
    filas,
    totales: ['Total', '', tot.mesas, tot.electores, tot.comp, `${tot.testigo} de ${tot.mesas}`],
  }
}

async function reporteMesas(db: Db, tenantId: string): Promise<Reporte> {
  const votantes = await db.voter.findMany({
    where:  { tenantId, votingTableId: { not: null } },
    select: { name: true, commitmentStatus: true, leader: { select: { name: true } }, votingTable: { select: { number: true, station: { select: { name: true } } } } },
  })
  const filas = votantes
    .map((v) => [v.votingTable!.station.name, v.votingTable!.number, v.name, v.leader?.name ?? '—', ETIQUETA_ESTADO[v.commitmentStatus] ?? v.commitmentStatus] as Celda[])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || (a[1] as number) - (b[1] as number) || String(a[2]).localeCompare(String(b[2])))
  return {
    titulo: 'Listado por puesto y mesa',
    descripcion: `${filas.length} electores con mesa asignada.`,
    columnas: ['Puesto', 'Mesa', 'Elector', 'Líder', 'Estado'],
    filas,
  }
}

async function reporteCalidad(db: Db, tenantId: string): Promise<Reporte> {
  const votantes = await db.voter.findMany({
    where:  { tenantId },
    select: {
      name: true, phone: true, address: true, lat: true, geoIntentadoEn: true, votingTableId: true,
      censoEstado: true, status: true, leader: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  })
  const filas: Celda[][] = []
  for (const v of votantes) {
    const p: string[] = []
    if (v.status !== 'ACTIVO') p.push('Inactivo')
    if (!v.phone) p.push('Sin teléfono (no puede entrar a la app)')
    if (!v.address) p.push('Sin dirección')
    else if (v.lat === null && v.geoIntentadoEn) p.push('Dirección no encontrada en el mapa')
    if (!v.votingTableId) p.push('Sin mesa')
    if (v.censoEstado === 'NO_ENCONTRADO') p.push('No aparece en el censo')
    else if (v.censoEstado === 'NOVEDAD') p.push('Novedad en el censo')
    else if (v.censoEstado === 'ERROR' || v.censoEstado === null) p.push('Censo sin verificar')
    if (p.length) filas.push([v.name, v.leader?.name ?? '—', p.join(' · ')])
  }
  return {
    titulo: 'Datos incompletos',
    descripcion: `${filas.length} de ${votantes.length} electores tienen algo por completar o revisar.`,
    columnas: ['Elector', 'Líder', 'Qué falta'],
    filas,
  }
}

async function reporteTestigos(db: Db, tenantId: string): Promise<Reporte> {
  const [puestos, asignadas] = await Promise.all([
    db.votingStation.findMany({ select: { name: true, tables: { select: { id: true } } }, orderBy: { name: 'asc' } }),
    db.witnessAssignment.findMany({ where: { tenantId }, select: { votingTableId: true } }),
  ])
  const cubiertas = new Set(asignadas.map((a) => a.votingTableId))
  let mesas = 0, con = 0
  const filas = puestos.map((p) => {
    const c = p.tables.filter((t) => cubiertas.has(t.id)).length
    mesas += p.tables.length; con += c
    return [p.name, p.tables.length, c, p.tables.length - c, `${pct(c, p.tables.length)} %`] as Celda[]
  }).sort((a, b) => (b[3] as number) - (a[3] as number))
  return {
    titulo: 'Cobertura de testigos',
    descripcion: 'Lo más descubierto primero: es por donde hay que nombrar testigos.',
    columnas: ['Puesto', 'Mesas', 'Con testigo', 'Sin testigo', 'Cobertura'],
    filas,
    totales: ['Total', mesas, con, mesas - con, `${pct(con, mesas)} %`],
  }
}

async function reportePreconteo(db: Db, tenantId: string): Promise<Reporte> {
  const c = await consolidarE14(db, tenantId, null)
  const filas: Celda[][] = []
  for (const g of c.agrupaciones) for (const cand of g.candidatos) filas.push([cand.nombre, g.nombre, cand.votosE14, `${pct(cand.votosE14, c.totalVotosE14)} %`])
  filas.sort((a, b) => (b[2] as number) - (a[2] as number))
  filas.push(['Votos en blanco', '', c.blancoE14, `${pct(c.blancoE14, c.totalVotosE14)} %`], ['Votos nulos', '', c.nulosE14, `${pct(c.nulosE14, c.totalVotosE14)} %`])
  return {
    titulo: 'Resultados de preconteo (E-14)',
    descripcion: `${c.mesasReportadas} de ${c.mesasTotales} mesas transmitidas por los testigos. Cifras de los E-14, antes del escrutinio.`,
    columnas: ['Candidato', 'Agrupación', 'Votos', '%'],
    filas,
    totales: ['Total', '', c.totalVotosE14, '100 %'],
  }
}

/** Borrador E-24: mesa por mesa, el escrutinio por candidato, con lo que cambió frente al E-14. */
async function reporteE24(db: Db, tenantId: string): Promise<Reporte> {
  const [mesas, candidatos, transmisiones, escrutinios] = await Promise.all([
    db.votingTable.findMany({ select: { id: true, number: true, station: { select: { name: true } } } }),
    db.candidate.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { order: 'asc' } }),
    db.e14Transmission.findMany({ where: { tenantId }, select: { votingTableId: true, finalData: true, manualData: true, extractedData: true } }),
    db.escrutinioMesa.findMany({ where: { tenantId }, select: { votingTableId: true, datos: true, estado: true } }),
  ])
  const e14 = new Map(transmisiones.map((t) => [t.votingTableId, votosDeE14(datosDeTransmision(t), candidatos)]))
  const esc = new Map(escrutinios.map((e) => [e.votingTableId, e]))
  const claves = [...candidatos.map((c) => c.id), CLAVE_BLANCO, CLAVE_NULOS]
  const ESTADO: Record<string, string> = { REVISADA: 'Sin cambios', CORREGIDA: 'Corregida' }

  const totales = new Map<string, number>()
  const filas = mesas
    .filter((m) => e14.get(m.id) || esc.has(m.id))
    .sort((a, b) => a.station.name.localeCompare(b.station.name) || a.number - b.number)
    .map((m) => {
      const v14 = e14.get(m.id) ?? {}
      const e = esc.get(m.id)
      const v = (e?.datos as Votos | undefined) ?? v14
      const celdas = claves.map((k) => {
        const n = v[k] ?? 0
        totales.set(k, (totales.get(k) ?? 0) + n)
        // La celda corregida se ve y se exporta con el valor del E-14 al lado.
        return e && n !== (v14[k] ?? 0) ? `${n} (E-14: ${v14[k] ?? 0})` : n
      })
      return [m.station.name, m.number, e ? ESTADO[e.estado] ?? e.estado : 'Pendiente', ...celdas, totalVotos(v)] as Celda[]
    })

  return {
    titulo: 'Borrador de escrutinio (E-24)',
    descripcion: 'Mesa por mesa, lo que quedó en el escrutinio de la comisión. Las celdas corregidas muestran entre paréntesis el valor del E-14. Las mesas pendientes conservan su E-14.',
    columnas: ['Puesto', 'Mesa', 'Estado', ...candidatos.map((c) => c.name), 'Blanco', 'Nulos', 'Total'],
    filas,
    totales: ['Total', '', '', ...claves.map((k) => totales.get(k) ?? 0), [...totales.values()].reduce((a, n) => a + n, 0)],
  }
}

export interface DatosE26 extends ConsolidadoE14 {
  departamento: string
  municipio:    string
  cargo:        string | null
  zonas:        { id: string; code: string; name: string | null }[]
  zonaActual:   { code: string; name: string | null } | null
  /** E-26 oficial cargado en Día E > Escrutinio > Formulario E-26 (null = aún no). */
  oficial:      Votos | null
  oficialObservacion: string | null
}

export async function getDatosE26(zonaId: string | null): Promise<DatosE26 | null> {
  const { db, tenantId, modulos } = await contexto()
  if (!modulos.includes('DIA_E')) return null

  const cfg = await db.tenantConfig.findUnique({
    where:  { tenantId },
    select: { electionOffice: true, electionDepartmentCode: true, electionMunicipalityDivipola: true },
  })
  const [depto, muni] = await Promise.all([
    cfg?.electionDepartmentCode ? db.department.findUnique({ where: { code: cfg.electionDepartmentCode }, select: { name: true } }) : null,
    cfg?.electionMunicipalityDivipola ? db.municipality.findUnique({ where: { divipola: cfg.electionMunicipalityDivipola }, select: { id: true, name: true } }) : null,
  ])
  const zonas = muni
    ? await db.zona.findMany({ where: { municipalityId: muni.id }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } })
    : []
  const zonaActual = zonas.find((z) => z.id === zonaId) ?? null
  const oficial = await db.e26Oficial.findUnique({
    where: { tenantId_alcance: { tenantId, alcance: zonaActual?.id ?? 'GENERAL' } },
    select: { datos: true, observacion: true },
  })

  return {
    ...(await consolidarE14(db, tenantId, zonaActual?.id ?? null)),
    departamento: depto?.name ?? '—',
    municipio:    muni?.name ?? '—',
    cargo:        cfg?.electionOffice ?? null,
    zonas,
    zonaActual,
    oficial: (oficial?.datos as Votos | undefined) ?? null,
    oficialObservacion: oficial?.observacion ?? null,
  }
}
