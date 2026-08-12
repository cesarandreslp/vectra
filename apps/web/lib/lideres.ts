/**
 * Títulos que la campaña le reconoce a un elector por el trabajo de red, en
 * dos ejes independientes — como los rangos de un multinivel.
 *
 * Que B reciba un título por su propia red NO le quita a A el crédito de
 * haber traído a B: quién trajo a quién vive aparte, en Voter.referredById, y
 * nada de lo de acá lo toca. Antes solo existía el eje de reclutamiento
 * directo, así que quien traía 9 de su mano y armaba 28 en total no aparecía
 * en ningún lado, mientras que uno de sus reclutados con 10 directos sí.
 *
 * Vive fuera de core/actions.ts porque un archivo 'use server' solo puede
 * exportar funciones async, no constantes.
 */

/** RECLUTADOR: electores traídos de su propia mano (followers directos). */
export const UMBRAL_LIDER_DIRECTOS = 10
/** CONSTRUCTOR: tamaño de la red completa debajo suyo, a cualquier profundidad. */
export const UMBRAL_LIDER_RED = 25

export type TituloLider = 'RECLUTADOR' | 'CONSTRUCTOR'

export const TITULOS: Record<TituloLider, { nombre: string; descripcion: string; color: string }> = {
  RECLUTADOR: {
    nombre:      'Reclutador',
    descripcion: `Trajo ${UMBRAL_LIDER_DIRECTOS} o más electores de su propia mano`,
    color:       '#1d4ed8',
  },
  CONSTRUCTOR: {
    nombre:      'Constructor de red',
    descripcion: `Su red completa llega a ${UMBRAL_LIDER_RED} o más personas`,
    color:       '#7c3aed',
  },
}

/**
 * Títulos ganados. Los dos ejes son independientes: se pueden tener ambos,
 * uno, o ninguno. "Ser líder" = tener al menos uno.
 */
export function titulosDe(directos: number, red: number): TituloLider[] {
  const titulos: TituloLider[] = []
  if (directos >= UMBRAL_LIDER_DIRECTOS) titulos.push('RECLUTADOR')
  if (red      >= UMBRAL_LIDER_RED)      titulos.push('CONSTRUCTOR')
  return titulos
}
