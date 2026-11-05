'use server'

/** Tablero del agente: qué pasa en las conversaciones y qué preocupa en cada comuna. */

import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { resumirTablero, type ConvTablero, type ResumenTablero } from '@/lib/agente/tablero'

export interface ComunaMapa { id: string; name: string; boundary: [number, number][] | null }

export interface TableroConversaciones {
  resumen: ResumenTablero
  comunas: ComunaMapa[]
}

export async function getTableroConversaciones(): Promise<TableroConversaciones> {
  const session  = await requireModuleOrScreen('ANALYTICS', ['ADMIN_CAMPANA', 'COORDINADOR'], 'ANALYTICS_CONVERSACIONES')
  const tenantId = session.user.tenantId
  const db       = getTenantDb(await getTenantConnection(tenantId))

  const [convs, comunas, barrios] = await Promise.all([
    db.conversacion.findMany({
      where:  { tenantId },
      select: {
        voterId: true, contactoId: true, autorizoEn: true, escaladaEn: true, atendidaEn: true, createdAt: true,
        mensajes: { where: { entrante: true, NOT: { temas: { isEmpty: true } } }, select: { temas: true } },
      },
    }),
    db.commune.findMany({ select: { id: true, name: true, boundary: true }, orderBy: { name: 'asc' } }),
    db.neighborhood.findMany({ select: { id: true, communeId: true } }),
  ])

  const voterIds = convs.map((c) => c.voterId).filter((x): x is string => Boolean(x))
  const contactoIds = convs.map((c) => c.contactoId).filter((x): x is string => Boolean(x))
  const [voters, contactos] = await Promise.all([
    voterIds.length
      ? db.voter.findMany({ where: { id: { in: voterIds } }, select: { id: true, neighborhoodId: true, commitmentStatus: true, esSimpatizante: true } })
      : [],
    contactoIds.length
      ? db.contactoCalle.findMany({ where: { id: { in: contactoIds } }, select: { id: true, nombre: true, estado: true, voterId: true, quiereSerVoluntario: true, communeId: true, neighborhoodId: true } })
      : [],
  ])
  // Un contacto convertido ya tiene elector: su compromiso es el del elector.
  const convertidos = contactos.map((k) => k.voterId).filter((x): x is string => Boolean(x))
  const votersConvertidos = convertidos.length
    ? await db.voter.findMany({ where: { id: { in: convertidos } }, select: { id: true, neighborhoodId: true, commitmentStatus: true, esSimpatizante: true } })
    : []

  const voterDe = new Map([...voters, ...votersConvertidos].map((v) => [v.id, v]))
  const contactoDe = new Map(contactos.map((k) => [k.id, k]))
  const comunaDeBarrio = new Map(barrios.map((b) => [b.id, b.communeId]))

  const filas: ConvTablero[] = convs.map((c) => {
    const k = c.contactoId ? contactoDe.get(c.contactoId) : undefined
    const v = voterDe.get(c.voterId ?? k?.voterId ?? '')
    const barrio = v?.neighborhoodId ?? k?.neighborhoodId ?? null
    return {
      autorizo:     Boolean(c.autorizoEn),
      pendiente:    Boolean(c.escaladaEn && !c.atendidaEn),
      escalada:     Boolean(c.escaladaEn),
      registrada:   Boolean(v || k?.nombre),
      elector:      Boolean(v),
      comprometido: v?.commitmentStatus === 'COMPROMETIDO' || v?.commitmentStatus === 'VOTO_SEGURO',
      voluntario:   Boolean(k?.quiereSerVoluntario || v?.esSimpatizante),
      comunaId:     (barrio && comunaDeBarrio.get(barrio)) ?? k?.communeId ?? null,
      temas:        c.mensajes.flatMap((m) => m.temas),
      creada:       c.createdAt,
    }
  })

  return {
    resumen: resumirTablero(filas, new Date()),
    comunas: comunas.map((k) => ({ id: k.id, name: k.name, boundary: (k.boundary as [number, number][] | null) ?? null })),
  }
}
