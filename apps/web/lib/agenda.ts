import { getTenantDb } from '@campaignos/db'

/**
 * Reglas de gestión de agenda. Hay dos ámbitos con gestores ("dolientes")
 * distintos: la del candidato (reservable por electores) y la de los jefes de
 * debate. El anfitrión ve su agenda pero no la escribe: la escribe el gestor
 * del ámbito, y si nadie tiene el ámbito el admin del tenant queda como respaldo.
 */

export type AgendaAmbito = 'CANDIDATO' | 'JEFES'
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
