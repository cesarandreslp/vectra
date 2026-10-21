import { getTenantDb } from '@vectra/db'

/**
 * Reglas de gestión de agenda. Hay dos ámbitos con gestores ("dolientes")
 * distintos: la del candidato (reservable por electores) y la de los jefes de
 * debate. El anfitrión ve su agenda pero no la escribe: la escribe el gestor
 * del ámbito, y si nadie tiene el ámbito el admin del tenant queda como respaldo.
 */

export type AgendaAmbito = 'CANDIDATO' | 'JEFES'
/** null = pendiente. Realizada con retrasoMin > 0 = arrancó tarde. */
export type EstadoAgenda = 'REALIZADA' | 'INCUMPLIDA' | 'CANCELADA'
type Db = ReturnType<typeof getTenantDb>

/** El candidato pertenece al ámbito CANDIDATO; cualquier otro anfitrión, a JEFES. */
export function ambitoDeAnfitrion(a: { isCandidate: boolean }): AgendaAmbito {
  return a.isCandidate ? 'CANDIDATO' : 'JEFES'
}

/** El Voter que gestiona un ámbito (el "doliente"), o null si no hay ninguno. */
export async function getGestor(ambito: AgendaAmbito, tenantId: string, db: Db) {
  return db.voter.findFirst({
    where:  { tenantId, gestionaAgenda: ambito },
    select: { id: true, name: true },
  })
}

/**
 * ¿Quién puede escribir en la agenda de un ámbito?
 * - El admin del tenant siempre puede (respaldo que además puede intervenir).
 * - El gestor asignado al ámbito puede sobre su ámbito.
 *
 * ponytail: admin-siempre-puede en vez del "admin SOLO si no hay gestor" del
 * schema, para no dejar la agenda sin quién la escriba mientras el gestor no
 * tenga su propia pantalla. Endurecer a respaldo-estricto junto con esa pantalla.
 */
export async function puedeGestionar(
  ambito: AgendaAmbito,
  opts: { tenantId: string; voterId?: string | null; esAdmin: boolean; db: Db },
): Promise<boolean> {
  if (opts.esAdmin) return true
  const gestor = await getGestor(ambito, opts.tenantId, opts.db)
  return Boolean(opts.voterId) && opts.voterId === gestor?.id
}

// ── Choques de franja ───────────────────────────────────────────────────────────
// Un compromiso ocupa su franja: los huecos LIBRES que se le cruzan dejan de
// ofrecerse (se borran). Los ya reservados no se tocan — hay un elector esperando
// y eso lo decide quien maneja la agenda. Al revés, no se publica un hueco encima
// de un compromiso vigente.

interface Franja { tenantId: string; anfitrionId: string; startsAt: Date; endsAt: Date }

const cruza = (f: Franja) => ({ tenantId: f.tenantId, anfitrionId: f.anfitrionId, startsAt: { lt: f.endsAt }, endsAt: { gt: f.startsAt } })

export async function ocuparFranja(db: Db, f: Franja) {
  await db.agendaEntrada.deleteMany({ where: { ...cruza(f), disponible: true, reservadoPor: null } })
}

export async function compromisoEnFranja(db: Db, f: Franja) {
  return db.agendaEntrada.findFirst({
    where:  { ...cruza(f), disponible: false, OR: [{ estado: null }, { estado: { not: 'CANCELADA' } }] },
    select: { titulo: true },
  })
}

/** Valida y crea un hueco o compromiso — lo comparten anfitrión, gestor y admin. */
export async function publicarEntrada(
  db: Db,
  f: Franja & { disponible: boolean; titulo?: string },
): Promise<{ success: boolean; error?: string }> {
  if (isNaN(+f.startsAt) || isNaN(+f.endsAt) || !(f.endsAt > f.startsAt)) return { success: false, error: 'La hora de fin debe ser después de la de inicio.' }
  if (!f.disponible && !f.titulo?.trim()) return { success: false, error: 'Falta el título del compromiso.' }

  if (f.disponible) {
    const choque = await compromisoEnFranja(db, f)
    if (choque) return { success: false, error: `Esa franja ya está ocupada por "${choque.titulo}".` }
  } else {
    await ocuparFranja(db, f)
  }

  await db.agendaEntrada.create({
    data: {
      tenantId: f.tenantId, anfitrionId: f.anfitrionId, startsAt: f.startsAt, endsAt: f.endsAt,
      disponible: f.disponible, titulo: f.disponible ? undefined : f.titulo!.trim(),
    },
  })
  return { success: true }
}
