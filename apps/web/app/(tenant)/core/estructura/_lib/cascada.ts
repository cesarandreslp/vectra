/** Factores editables de la meta en cascada (viven en TenantConfig). */
export interface FactoresCascada {
  tasaFuga:                    number // fracción de compromisos que no llega a votar
  tasaConversion:              number // fracción de contactos que termina en compromiso
  compromisosPorMultiplicador: number
  multiplicadoresPorLider:     number
}

export interface Niveles {
  contactos:       number
  compromisos:     number
  multiplicadores: number
  lideres:         number
}

/** De la meta de votos hacia abajo: lo necesario en cada nivel, siempre redondeado hacia arriba. */
export function calcularCascada(metaVotos: number, f: FactoresCascada): Niveles {
  const compromisos     = Math.ceil(metaVotos / (1 - f.tasaFuga))
  const contactos       = Math.ceil(compromisos / f.tasaConversion)
  const multiplicadores = Math.ceil(compromisos / f.compromisosPorMultiplicador)
  const lideres         = Math.ceil(multiplicadores / f.multiplicadoresPorLider)
  return { compromisos, contactos, multiplicadores, lideres }
}
