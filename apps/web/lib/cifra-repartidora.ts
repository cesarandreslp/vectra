/**
 * Asignación de curules en corporaciones públicas (concejo, asamblea, JAL),
 * como la hace la comisión escrutadora al declarar la elección (E-26):
 *
 * - Votos válidos = votos por agrupaciones + votos en blanco.
 * - Cociente electoral = votos válidos / curules.
 * - Umbral = 50 % del cociente (30 % si la circunscripción elige 2 curules o menos),
 *   Constitución art. 263. Solo compiten las agrupaciones que lo superan.
 * - Cifra repartidora (D'Hondt): se divide la votación de cada agrupación entre
 *   1, 2, 3… y el resultado número `curules`, de mayor a menor, es la cifra.
 *   Cada agrupación gana tantas curules como veces cabe la cifra en su votación.
 *
 * Los empates en la última curul los define la ley por sorteo: aquí se marcan,
 * no se resuelven.
 */
export interface VotacionAgrupacion { nombre: string; votos: number }

export interface ResultadoCurules {
  votosValidos: number
  cociente:     number
  umbral:       number
  /** 0 si ninguna agrupación supera el umbral. */
  cifraRepartidora: number
  agrupaciones: { nombre: string; votos: number; superaUmbral: boolean; curules: number }[]
  /** Hay un empate en la última curul: la decide un sorteo, no esta cuenta. */
  empateUltimaCurul: boolean
}

export function asignarCurules(agrupaciones: VotacionAgrupacion[], votosEnBlanco: number, curules: number): ResultadoCurules {
  if (!Number.isInteger(curules) || curules < 1) throw new Error('Las curules deben ser un entero positivo')

  const votosValidos = agrupaciones.reduce((a, g) => a + g.votos, 0) + votosEnBlanco
  const cociente = votosValidos / curules
  const umbral   = cociente * (curules <= 2 ? 0.3 : 0.5)
  const compiten = agrupaciones.filter((g) => g.votos > 0 && g.votos >= umbral)

  const cocientes = compiten
    .flatMap((g) => Array.from({ length: curules }, (_, i) => g.votos / (i + 1)))
    .sort((a, b) => b - a)
  const cifraRepartidora = cocientes[curules - 1] ?? 0
  const empateUltimaCurul = cifraRepartidora > 0 && cocientes[curules] === cifraRepartidora

  return {
    votosValidos, cociente, umbral, cifraRepartidora, empateUltimaCurul,
    agrupaciones: agrupaciones
      .map((g) => {
        const superaUmbral = compiten.includes(g)
        return { ...g, superaUmbral, curules: superaUmbral && cifraRepartidora > 0 ? Math.floor(g.votos / cifraRepartidora) : 0 }
      })
      .sort((a, b) => b.votos - a.votos),
  }
}
