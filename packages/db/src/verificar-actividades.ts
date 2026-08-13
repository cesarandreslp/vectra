#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Verifica el módulo de actividades sociales contra el tenant real:
 * crea actividad → grupo → miembro (marca simpatizante) → insumo → cambia estado,
 * comprueba los agregados que usa la UI y BORRA todo lo que creó.
 *
 * Correr desde packages/db:  tsx src/verificar-actividades.ts
 */
import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const ok = (c: boolean, msg: string) => { console.log(`${c ? '✔' : '✘'} ${msg}`); if (!c) process.exitCode = 1 }

async function main() {
  const superadmin = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }) })
  const t = await superadmin.tenant.findFirst({ where: { isActive: true }, select: { id: true, slug: true, connectionString: true } })
  if (!t) { console.log('No hay tenant activo'); process.exit(1) }
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: decrypt(t.connectionString) }) })
  const tenantId = t.id

  const voter = await db.voter.findFirst({ where: { tenantId }, select: { id: true, name: true, esSimpatizante: true } })
  if (!voter) { console.log('El tenant no tiene electores; no se puede probar miembros.'); process.exit(1) }

  let actividadId: string | null = null
  try {
    const act = await db.actividad.create({ data: { tenantId, nombre: '__test brigada', categoria: 'salud', fecha: new Date(), dolienteId: voter.id } })
    ok((await db.actividad.findUnique({ where: { id: act.id }, include: { doliente: true } }))?.doliente.id === voter.id, 'la actividad guarda su doliente')
    actividadId = act.id
    const grupo = await db.grupoActividad.create({ data: { tenantId, actividadId: act.id, nombre: '__test parque', lugar: 'cra 1', responsableId: voter.id } })

    // miembro + flag simpatizante (mismo $transaction que la server action)
    await db.$transaction([
      db.miembroGrupo.create({ data: { tenantId, grupoId: grupo.id, voterId: voter.id } }),
      db.voter.update({ where: { id: voter.id }, data: { esSimpatizante: true } }),
    ])
    const marcado = await db.voter.findUnique({ where: { id: voter.id }, select: { esSimpatizante: true } })
    ok(marcado?.esSimpatizante === true, 'el miembro queda marcado como simpatizante')

    const insumo = await db.insumoGrupo.create({ data: { tenantId, grupoId: grupo.id, descripcion: '__test carpa', tipo: 'MATERIAL', cantidad: 2, costoEstimado: 150000 } })
    ok(insumo.estado === 'REQUERIDO', 'el insumo nace en REQUERIDO')
    const aprobado = await db.insumoGrupo.update({ where: { id: insumo.id }, data: { estado: 'APROBADO' } })
    ok(aprobado.estado === 'APROBADO', 'el tesorero puede pasarlo a APROBADO')

    // agregados de getActividades()
    const listado = await db.actividad.findMany({
      where: { tenantId, id: act.id },
      include: { grupos: { select: { _count: { select: { miembros: true, insumos: true } } } } },
    })
    const a = listado[0]!
    ok(a.grupos.length === 1, 'getActividades cuenta 1 grupo')
    ok(a.grupos.reduce((n, g) => n + g._count.miembros, 0) === 1, 'getActividades cuenta 1 simpatizante')
    ok(a.grupos.reduce((n, g) => n + g._count.insumos, 0) === 1, 'getActividades cuenta 1 insumo')

    // includes de getActividadDetalle()
    const det = await db.actividad.findFirst({
      where: { id: act.id, tenantId },
      include: { grupos: { include: { responsable: { select: { name: true } }, miembros: { include: { voter: { select: { name: true } } } }, insumos: true } } },
    })
    ok(det?.grupos[0]?.responsable?.name === voter.name, 'el detalle trae el responsable')
    ok(det?.grupos[0]?.miembros[0]?.voter.name === voter.name, 'el detalle trae el nombre del miembro')
  } finally {
    if (actividadId) {
      await db.actividad.delete({ where: { id: actividadId } }) // cascada: grupos, miembros, insumos
      const quedan = await db.grupoActividad.count({ where: { actividadId } })
      ok(quedan === 0, 'borrar la actividad arrastra grupos/miembros/insumos en cascada')
    }
    await db.voter.update({ where: { id: voter.id }, data: { esSimpatizante: voter.esSimpatizante } })
    await db.$disconnect(); await superadmin.$disconnect()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
