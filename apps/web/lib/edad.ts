/**
 * Edad y elegibilidad electoral. En Colombia se vota (y se es testigo) desde los
 * 18 años cumplidos. La edad se mide contra "hoy" por defecto; se puede pasar la
 * fecha de la elección para exigir que los cumpla el día E, no antes.
 */

export const EDAD_VOTO = 18

/** Años cumplidos a la fecha de referencia. */
export function edadEnAnios(nacimiento: Date, ref: Date = new Date()): number {
  let edad = ref.getFullYear() - nacimiento.getFullYear()
  const m = ref.getMonth() - nacimiento.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < nacimiento.getDate())) edad--
  return edad
}

/** Apto para votar / ser testigo: 18+ cumplidos. */
export function esMayorDeEdad(nacimiento: Date, ref: Date = new Date()): boolean {
  return edadEnAnios(nacimiento, ref) >= EDAD_VOTO
}
