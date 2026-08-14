/**
 * Consenso entre dos lecturas del E-14.
 *
 * Antes recibía siempre Groq y Zhipu; ahora la segunda puede ser el respaldo
 * (Mistral) cuando una principal falla, así que los parámetros se llaman A y B.
 * A es la lectura primaria: es la que se usa tal cual si la confianza es baja.
 */

import type { E14ExtractionResult } from './index'

export interface ConsensoResult {
  data: E14ExtractionResult
  confidence: 'ALTA' | 'MEDIA' | 'BAJA'
  discrepancies: string[]
}

type Fila = E14ExtractionResult['candidatos'][number]

/** Normaliza un nombre para comparación: trim, lowercase, sin acentos */
function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/**
 * Clave con la que se cruzan las dos lecturas.
 *
 * El NÚMERO del renglón manda: es lo que ambos modelos leen igual. El nombre
 * queda de respaldo para cuando el número no se pudo leer. Cruzar por nombre
 * era el defecto que hundía la confianza — dos modelos escriben "OYTHER" y
 * "Oytther", y un acta con los votos idénticos salía entera en discrepancia.
 */
function clave(c: Fila): string {
  return c.numero !== null ? `n:${c.numero}` : `t:${normalize(c.nombre)}`
}

/** Etiqueta legible del renglón, para la lista de discrepancias. */
function etiqueta(c: Fila): string {
  return c.numero !== null ? `${c.numero}. ${c.nombre}` : c.nombre
}

/**
 * Determina el consenso entre dos lecturas de un E-14.
 *
 * - Si todos los renglones coinciden en votos → ALTA
 * - Si difieren en 1 → MEDIA (promedio redondeado en ese renglón)
 * - Si difieren en 2+ → BAJA (se usa la lectura A tal cual)
 */
export function consensoE14(
  lecturaA: E14ExtractionResult,
  lecturaB: E14ExtractionResult,
): ConsensoResult {
  const mapaB = new Map<string, Fila>()
  for (const c of lecturaB.candidatos) mapaB.set(clave(c), c)

  const discrepancies: string[] = []
  const mergedCandidatos: Fila[] = []

  for (const a of lecturaA.candidatos) {
    const b = mapaB.get(clave(a))

    if (b && a.votos !== null && b.votos !== null) {
      if (a.votos === b.votos) {
        mergedCandidatos.push(a)
      } else {
        discrepancies.push(etiqueta(a))
        mergedCandidatos.push({ ...a, votos: Math.round((a.votos + b.votos) / 2) })
      }
    } else {
      // Solo A tiene este renglón, o alguna de las dos no pudo leer los votos.
      mergedCandidatos.push(a)
      if (a.votos !== null && !b) discrepancies.push(etiqueta(a))
    }
  }

  // Renglones que solo vio B.
  const clavesA = new Set(lecturaA.candidatos.map(clave))
  for (const b of lecturaB.candidatos) {
    if (clavesA.has(clave(b))) continue
    mergedCandidatos.push(b)
    discrepancies.push(etiqueta(b))
  }

  const totalVotos = lecturaA.totalVotos ?? lecturaB.totalVotos
  const mesaNumero   = lecturaA.mesaNumero ?? lecturaB.mesaNumero
  const puestoNombre = lecturaA.puestoNombre ?? lecturaB.puestoNombre

  if (discrepancies.length === 0) {
    return {
      confidence: 'ALTA',
      discrepancies,
      data: {
        candidatos: mergedCandidatos, totalVotos, mesaNumero, puestoNombre,
        rawResponse: `consenso:ALTA a:${lecturaA.rawResponse.slice(0, 100)}`,
      },
    }
  }

  if (discrepancies.length === 1) {
    return {
      confidence: 'MEDIA',
      discrepancies,
      data: {
        candidatos: mergedCandidatos, totalVotos, mesaNumero, puestoNombre,
        rawResponse: `consenso:MEDIA disc:${discrepancies[0]}`,
      },
    }
  }

  return {
    confidence: 'BAJA',
    discrepancies,
    // Con dos o más renglones en disputa no se promedia nada: se deja la
    // lectura A entera y que la resuelva el testigo contra el acta física.
    data: {
      candidatos:  lecturaA.candidatos,
      totalVotos:  lecturaA.totalVotos,
      mesaNumero:   lecturaA.mesaNumero,
      puestoNombre: lecturaA.puestoNombre,
      rawResponse: `consenso:BAJA disc:${discrepancies.join(',')}`,
    },
  }
}
