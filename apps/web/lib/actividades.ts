/**
 * Reglas de negocio de actividades sociales, compartidas por las dos puertas de
 * entrada: el panel del admin (/core/actividades) y el PWA del doliente
 * (/pwa/actividades). Viven acá para que una sola implementación decida, y no
 * se pueda saltar una regla entrando por la otra pantalla.
 */

import { getTenantDb } from '@vectra/db'

type Db = ReturnType<typeof getTenantDb>

const reloj = (d: Date) => d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/**
 * Tumba la aprobación del presupuesto: se aprobó un monto y el monto cambió.
 * Aplica también si la actividad ya arrancó — no la frena, pero vuelve a la
 * bandeja del tesorero. Sin esto se cargarían gastos después de aprobado sin
 * que finanzas se entere.
 */
export async function invalidarPresupuesto(db: Db, actividadId: string): Promise<void> {
  await db.actividad.updateMany({
    where: { id: actividadId, presupuestoAprobado: true, estado: { in: ['PLANEADA', 'EN_CURSO'] } },
    data:  { presupuestoAprobado: false, presupuestoAprobadoPor: null, presupuestoAprobadoEn: null },
  })
}

/**
 * Agrega un elector a un grupo y lo marca simpatizante (todo miembro lo es).
 *
 * Nadie puede estar en dos lugares a la vez: si el grupo tiene franja horaria,
 * se rechaza cuando se pisa con otra donde esa persona ya está anotada. Los
 * grupos sin horario no se pueden chequear y no bloquean.
 */
export async function agregarMiembroAGrupo(
  db: Db, tenantId: string, grupoId: string, voterId: string,
): Promise<{ success: boolean; error?: string }> {
  const grupo = await db.grupoActividad.findFirst({
    where:  { id: grupoId, tenantId },
    select: { id: true, inicio: true, duracionMin: true },
  })
  if (!grupo) return { success: false, error: 'Grupo no encontrado.' }

  const v = await db.voter.findFirst({ where: { id: voterId, tenantId }, select: { id: true } })
  if (!v) return { success: false, error: 'Elector no válido.' }

  const ya = await db.miembroGrupo.findFirst({ where: { grupoId, voterId }, select: { id: true } })
  if (ya) return { success: false, error: 'Ya está en el grupo.' }

  if (grupo.inicio && grupo.duracionMin) {
    const inicio = grupo.inicio
    const fin    = new Date(inicio.getTime() + grupo.duracionMin * 60_000)

    const otros = await db.miembroGrupo.findMany({
      where:  { tenantId, voterId, grupo: { inicio: { not: null }, duracionMin: { not: null } } },
      select: { grupo: { select: { nombre: true, inicio: true, duracionMin: true, actividad: { select: { nombre: true } } } } },
    })

    const choque = otros.find(({ grupo: o }) => {
      const oInicio = o.inicio!
      const oFin    = new Date(oInicio.getTime() + o.duracionMin! * 60_000)
      return inicio < oFin && oInicio < fin
    })
    if (choque) {
      const o = choque.grupo
      return {
        success: false,
        error: `Se cruza: ya está en "${o.nombre}" (${o.actividad.nombre}), ${reloj(o.inicio!)} a ${reloj(new Date(o.inicio!.getTime() + o.duracionMin! * 60_000))}.`,
      }
    }
  }

  await db.$transaction([
    db.miembroGrupo.create({ data: { tenantId, grupoId, voterId } }),
    db.voter.update({ where: { id: voterId }, data: { esSimpatizante: true } }),
  ])
  return { success: true }
}
