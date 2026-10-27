/**
 * Una sola regla para medir avance contra una meta en toda la app: las metas
 * (de la campaña, de cada comuna, de cada líder) se fijan en VOTOS, y el
 * avance se mide en COMPROMISOS (comprometido + voto seguro). Como una parte
 * de los compromisos no llega a votar (TenantConfig.tasaFuga), una meta de 100
 * votos pide 125 compromisos con fuga del 20 %. Así el mapa de calor, los
 * líderes y la meta en cascada de Estructura miden lo mismo.
 */

import type { getTenantDb } from '@vectra/db'

export const TASA_FUGA_POR_DEFECTO = 0.2

/** Compromisos que hacen falta para sacar `metaVotos`, redondeado hacia arriba. */
export function compromisosParaMeta(metaVotos: number, tasaFuga: number): number {
  return Math.ceil(metaVotos / (1 - tasaFuga))
}

/** % de avance (0 sin meta): compromisos sobre los compromisos que pide la meta. */
export function avanceMeta(compromisos: number, metaVotos: number | null, tasaFuga: number): number {
  if (!metaVotos || metaVotos <= 0) return 0
  return Math.round((compromisos / compromisosParaMeta(metaVotos, tasaFuga)) * 100)
}

/** Fuga configurada por la campaña (o la de por defecto). */
export async function leerTasaFuga(db: ReturnType<typeof getTenantDb>, tenantId: string): Promise<number> {
  const cfg = await db.tenantConfig.findUnique({ where: { tenantId }, select: { tasaFuga: true } })
  return cfg?.tasaFuga ?? TASA_FUGA_POR_DEFECTO
}

/**
 * Aviso cuando las metas por comuna (Territorio) no reparten exactamente la
 * meta global de la campaña. null = cuadran, o falta alguna de las dos.
 */
export function descuadreMetas(metaGlobal: number | null, sumaComunas: number): string | null {
  if (!metaGlobal || sumaComunas === 0 || sumaComunas === metaGlobal) return null
  const fmt = (n: number) => n.toLocaleString('es-CO')
  const dif = metaGlobal - sumaComunas
  return dif > 0
    ? `Las metas por comuna suman ${fmt(sumaComunas)} de ${fmt(metaGlobal)} votos: faltan ${fmt(dif)} por repartir en el territorio.`
    : `Las metas por comuna suman ${fmt(sumaComunas)}, ${fmt(-dif)} más que la meta de la campaña (${fmt(metaGlobal)}).`
}
