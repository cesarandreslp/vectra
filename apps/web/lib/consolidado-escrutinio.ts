/**
 * Consolidado de una zona (o de todo el municipio) sumando mesa a mesa el
 * preconteo (E-14) y el escrutinio (borrador E-24). Lo usan el acta E-26 de
 * Reportes y el formulario E-26 del Día E, cada uno con su propio permiso.
 */
import type { getTenantDb } from '@vectra/db'
import { CLAVE_BLANCO, CLAVE_NULOS, datosDeTransmision, votosDeE14, totalVotos, type Votos } from './escrutinio'

type Db = ReturnType<typeof getTenantDb>

export interface ConsolidadoE14 {
  mesasTotales:     number
  /** Mesas con E-14 transmitido por el testigo de mesa. */
  mesasReportadas:  number
  /** Mesas que el testigo ante la comisión ya registró en el escrutinio. */
  mesasRevisadas:   number
  mesasCorregidas:  number
  mesasSinReporte:  { puesto: string; mesa: number }[]
  /** `votos` = escrutinio (E-24; si la mesa no se ha revisado, su E-14). `votosE14` = preconteo. */
  agrupaciones: {
    nombre: string; total: number; totalE14: number
    candidatos: { clave: string; nombre: string; votos: number; votosE14: number; propio: boolean }[]
  }[]
  blanco: number; blancoE14: number
  nulos:  number; nulosE14:  number
  /** Agrupaciones + blanco + nulos, del escrutinio. */
  totalVotos:       number
  totalVotosE14:    number
}

/**
 * Suma mesa a mesa el preconteo (E-14 transmitido) y el escrutinio (borrador
 * E-24 que lleva el testigo ante la comisión). `zonaId` acota a una zona
 * electoral (E-26 parcial de comisión auxiliar); null = todo el municipio.
 */
export async function consolidarE14(db: Db, tenantId: string, zonaId: string | null): Promise<ConsolidadoE14> {
  const [mesas, candidatos, transmisiones, escrutinios] = await Promise.all([
    db.votingTable.findMany({
      where:  zonaId ? { station: { zonaId } } : {},
      select: { id: true, number: true, station: { select: { name: true } } },
    }),
    db.candidate.findMany({ where: { tenantId }, orderBy: { order: 'asc' } }),
    db.e14Transmission.findMany({ where: { tenantId }, select: { votingTableId: true, finalData: true, manualData: true, extractedData: true } }),
    db.escrutinioMesa.findMany({ where: { tenantId }, select: { votingTableId: true, datos: true, estado: true } }),
  ])
  const e14 = new Map(transmisiones.map((t) => [t.votingTableId, votosDeE14(datosDeTransmision(t), candidatos)]))
  const esc = new Map(escrutinios.map((e) => [e.votingTableId, e]))

  const pre: Votos = {}, fin: Votos = {}
  let reportadas = 0, revisadas = 0, corregidas = 0
  const sinReporte: ConsolidadoE14['mesasSinReporte'] = []
  for (const m of mesas) {
    const v14 = e14.get(m.id) ?? null
    const e = esc.get(m.id)
    if (v14) reportadas++
    if (e) { revisadas++; if (e.estado === 'CORREGIDA') corregidas++ }
    if (!v14 && !e) sinReporte.push({ puesto: m.station.name, mesa: m.number })
    for (const [k, n] of Object.entries(v14 ?? {})) pre[k] = (pre[k] ?? 0) + n
    for (const [k, n] of Object.entries((e?.datos as Votos | undefined) ?? v14 ?? {})) fin[k] = (fin[k] ?? 0) + n
  }

  const porAgrupacion = new Map<string, ConsolidadoE14['agrupaciones'][number]>()
  for (const c of candidatos) {
    const nombre = c.party?.trim() || c.name
    const g = porAgrupacion.get(nombre) ?? { nombre, total: 0, totalE14: 0, candidatos: [] }
    g.candidatos.push({ clave: c.id, nombre: c.name, votos: fin[c.id] ?? 0, votosE14: pre[c.id] ?? 0, propio: c.isOwn })
    g.total += fin[c.id] ?? 0
    g.totalE14 += pre[c.id] ?? 0
    porAgrupacion.set(nombre, g)
  }

  return {
    mesasTotales: mesas.length, mesasReportadas: reportadas, mesasRevisadas: revisadas, mesasCorregidas: corregidas,
    mesasSinReporte: sinReporte.sort((a, b) => a.puesto.localeCompare(b.puesto) || a.mesa - b.mesa),
    agrupaciones: [...porAgrupacion.values()].sort((a, b) => b.total - a.total),
    blanco: fin[CLAVE_BLANCO] ?? 0, blancoE14: pre[CLAVE_BLANCO] ?? 0,
    nulos:  fin[CLAVE_NULOS] ?? 0,  nulosE14:  pre[CLAVE_NULOS] ?? 0,
    totalVotos: totalVotos(fin), totalVotosE14: totalVotos(pre),
  }
}
