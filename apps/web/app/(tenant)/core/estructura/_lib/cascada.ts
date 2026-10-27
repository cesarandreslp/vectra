import { compromisosParaMeta } from '@/lib/meta-votos'

/** Factores editables de la meta en cascada (viven en TenantConfig). */
export interface FactoresCascada {
  tasaFuga:                    number // fracción de compromisos que no llega a votar
  tasaConversion:              number // fracción de contactos que termina en compromiso
  compromisosPorMultiplicador: number
  multiplicadoresPorLider:     number
}

/** Los factores guardados en TenantConfig, con su valor por defecto donde falten. */
export function factoresDe(cfg: { [K in keyof FactoresCascada]?: number | null } | null): FactoresCascada {
  return {
    tasaFuga:                    cfg?.tasaFuga ?? 0.2,
    tasaConversion:              cfg?.tasaConversion ?? 0.4,
    compromisosPorMultiplicador: cfg?.compromisosPorMultiplicador ?? 12,
    multiplicadoresPorLider:     cfg?.multiplicadoresPorLider ?? 10,
  }
}

export interface Niveles {
  contactos:       number
  compromisos:     number
  multiplicadores: number
  lideres:         number
}

/** De la meta de votos hacia abajo: lo necesario en cada nivel, siempre redondeado hacia arriba. */
export function calcularCascada(metaVotos: number, f: FactoresCascada): Niveles {
  const compromisos     = compromisosParaMeta(metaVotos, f.tasaFuga)
  const contactos       = Math.ceil(compromisos / f.tasaConversion)
  const multiplicadores = Math.ceil(compromisos / f.compromisosPorMultiplicador)
  const lideres         = Math.ceil(multiplicadores / f.multiplicadoresPorLider)
  return { compromisos, contactos, multiplicadores, lideres }
}

const CLAVES: (keyof Niveles)[] = ['contactos', 'compromisos', 'multiplicadores', 'lideres']

/**
 * Lo esperado a `hoy` interpolando en línea recta entre el hito anterior (o
 * ceros en `inicio`) y el siguiente. Pasado el último hito, se espera el último.
 * `hitos` debe venir ordenado por fecha.
 */
export function esperadoHoy<H extends Niveles & { fecha: Date }>(
  hitos: H[], inicio: Date, hoy: Date,
): { proximo: H | null; esperado: Niveles | null } {
  if (hitos.length === 0) return { proximo: null, esperado: null }
  const i = hitos.findIndex((h) => h.fecha.getTime() >= hoy.getTime())
  if (i === -1) return { proximo: null, esperado: pick(hitos[hitos.length - 1]) }

  const sig  = hitos[i]
  const prev = i > 0 ? hitos[i - 1] : { fecha: inicio, contactos: 0, compromisos: 0, multiplicadores: 0, lideres: 0 }
  const span = sig.fecha.getTime() - prev.fecha.getTime()
  const t    = span > 0 ? Math.min(1, Math.max(0, (hoy.getTime() - prev.fecha.getTime()) / span)) : 1
  const esperado = pick(sig)
  for (const k of CLAVES) esperado[k] = Math.round(prev[k] + (sig[k] - prev[k]) * t)
  return { proximo: sig, esperado }
}

export type Estado = 'adelantado' | 'a tiempo' | 'atrasado'

/** ±10 % de lo esperado cuenta como a tiempo. */
export function estadoNivel(real: number, esperado: number): Estado {
  if (esperado <= 0) return real > 0 ? 'adelantado' : 'a tiempo'
  const r = real / esperado
  return r > 1.1 ? 'adelantado' : r >= 0.9 ? 'a tiempo' : 'atrasado'
}

function pick(n: Niveles): Niveles {
  return { contactos: n.contactos, compromisos: n.compromisos, multiplicadores: n.multiplicadores, lideres: n.lideres }
}
