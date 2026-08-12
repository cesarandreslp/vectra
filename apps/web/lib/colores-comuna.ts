/**
 * Color con el que se distingue cada comuna/corregimiento.
 *
 * El color se deriva de la POSICIÓN de la zona dentro de la lista completa del
 * municipio ordenada por nombre, no del orden en que llegue cada consulta. Así
 * "Comuna 3" es del mismo color en Territorio y en el mapa del dashboard, que
 * es lo único que hace útil el color: si cambiara entre pantallas, no
 * identificaría nada.
 *
 * Los tonos se reparten con el ángulo áureo (137.5°) en vez de una paleta fija:
 * Buga solo tiene 24 zonas, pero otro municipio puede tener 60 y una paleta de
 * 12 colores empezaría a repetir. Con el ángulo áureo, tonos consecutivos caen
 * siempre lejos entre sí, sea cual sea el total.
 */

const ANGULO_AUREO = 137.508

/** Color de la zona que ocupa la posición `indice` en la lista del municipio. */
export function colorDeZona(indice: number): string {
  const tono = (indice * ANGULO_AUREO) % 360
  // Saturación y luminosidad fijas: los polígonos van semitransparentes sobre
  // el mapa y el chip de Territorio es pequeño, así que hace falta color sólido.
  return `hsl(${tono.toFixed(1)}, 62%, 45%)`
}

/**
 * Mapa id → color a partir de los ids del municipio YA ORDENADOS por nombre.
 * El llamador es responsable de ese orden; es lo que mantiene el color estable.
 */
export function coloresPorZona(idsOrdenados: string[]): Map<string, string> {
  return new Map(idsOrdenados.map((id, i) => [id, colorDeZona(i)]))
}
