/**
 * Contrato compartido para leer el acta E-14: qué se le pide al modelo y cómo
 * se interpreta lo que responde. Lo usan los tres clientes de visión: si cada
 * uno pidiera o parseara los campos a su manera, las lecturas no se podrían
 * cruzar entre sí, que es justo de lo que vive el consenso.
 *
 * Se pide el NÚMERO del renglón además del nombre porque el número es la
 * identidad real del candidato en el tarjetón. Los modelos leen bien las
 * cifras pero escriben los nombres distinto ("OYTHER" / "Oytther",
 * "ELIEZER" / "ELIECER"), así que cruzar por nombre generaba discrepancias
 * falsas y hundía la confianza de actas que estaban perfectas.
 */

import type { E14ExtractionResult } from './index'

export const E14_SYSTEM_PROMPT = `Eres un sistema de extracción de datos de formularios electorales colombianos. El formulario E-14 contiene los votos por candidato en una mesa de votación.
Extrae TODOS los candidatos y sus votos del formulario.
El tarjetón va NUMERADO: cada renglón tiene su número impreso a la izquierda. Ese número es la identidad del candidato — cópialo tal cual, no lo deduzcas por la posición.
Responde SOLO con JSON válido en este formato exacto:
{ "candidatos": [{ "numero": number, "nombre": "string", "votos": number }], "totalVotos": number, "mesaNumero": "string" }
Si no puedes leer algún valor con certeza, usa null.
No inventes datos — solo extrae lo que es legible.`

/**
 * Número si el valor es realmente un número, si no null.
 *
 * No sirve `Number(x)` a secas: `Number(null)` y `Number('')` dan 0, y el
 * prompt pide explícitamente null cuando el modelo no pudo leer un valor. Un 0
 * inventado en un acta electoral es un voto perdido, no un dato faltante.
 */
function numeroONull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

/**
 * Interpreta la respuesta del modelo. Los tres clientes la comparten para que
 * una lectura de Groq y una de Mistral tengan exactamente la misma forma.
 *
 * Si el JSON no se puede leer devuelve una lectura VACÍA con su rawResponse:
 * el que llama debe tratar `candidatos: []` como "no leyó", no como "leyó cero
 * votos". La respuesta cruda se conserva porque es la que hay que mirar cuando
 * algo salió mal.
 */
export function parsearRespuestaE14(rawResponse: string): E14ExtractionResult {
  try {
    // La respuesta puede venir envuelta en markdown.
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? rawResponse)
    const crudos: unknown[] = Array.isArray(parsed.candidatos) ? parsed.candidatos : []

    return {
      candidatos: crudos.map((c) => {
        const fila = c as { numero?: unknown; nombre?: unknown; votos?: unknown }
        return {
          numero: numeroONull(fila.numero),
          nombre: String(fila.nombre ?? '').trim(),
          votos:  numeroONull(fila.votos),
        }
      }),
      totalVotos: numeroONull(parsed.totalVotos),
      mesaNumero: parsed.mesaNumero != null ? String(parsed.mesaNumero) : null,
      rawResponse,
    }
  } catch {
    return { candidatos: [], totalVotos: null, mesaNumero: null, rawResponse }
  }
}
