import { chatGroq } from '@vectra/ai'

export interface Candidate {
  id: string
  name: string
  code?: string | null
}

export class CandidateMatcher {
  /**
   * Identifica a qué candidato se refiere un texto libre usando el módulo AI de Vectra.
   *
   * @param text La respuesta libre del elector por WhatsApp (ej. "el negro", "bictor", "ninguno")
   * @param candidatos Lista de candidatos oficiales para ese cargo
   * @returns El ID del candidato identificado, o null si no se pudo identificar
   */
  async matchCandidate(
    text: string,
    candidatos: Candidate[],
    groqApiKey?: string
  ): Promise<string | null> {
    if (!candidatos || candidatos.length === 0 || !text) {
      return null
    }

    // Sin clave propia del tenant: no identificar (en vez de caer en silencio
    // a process.env.GROQ_API_KEY y cobrar la clasificación contra el SaaS).
    // Mismo resultado que una respuesta ambigua — la encuesta queda guardada,
    // solo sin candidato asociado.
    if (!groqApiKey) {
      return null
    }

    const candidatosFormat = candidatos
      .map((c) => {
        const codeInfo = c.code ? ` | Código de lista: ${c.code}` : ''
        return `- ID: ${c.id} | Nombre oficial: ${c.name}${codeInfo}`
      })
      .join('\n')

    const prompt = `
Eres un asistente que clasifica respuestas de encuestas políticas en Colombia.
Tu única tarea es identificar a qué candidato se refiere el elector, incluso si hay errores ortográficos, alias, apodos comunes, variaciones del nombre, o si usa el código de lista electoral.

LISTA DE CANDIDATOS OFICIALES PARA ESTE CARGO:
${candidatosFormat}

RESPUESTA DEL ELECTOR: "${text}"

INSTRUCCIONES:
1. Analiza la respuesta del elector y compárala con los candidatos oficiales.
2. Si la respuesta indica claramente la intención de votar por uno de los candidatos (por nombre, apodo, o código de lista como "U 101", "C 23", etc.), extrae su ID.
3. Si la respuesta es ambigua, indica que votará en blanco, o dice un nombre que NO está en la lista oficial, debes devolver ID: null.
4. Tu respuesta debe ser ÚNICAMENTE un JSON válido con el siguiente formato exacto, sin markdown ni explicaciones adicionales:
{"candidatoId": "el-id-encontrado-o-null"}
`

    try {
      const responseText = await chatGroq(prompt, text, groqApiKey)
      
      // Limpiar posibles bloques markdown del JSON
      const cleanJson = responseText.replace(/```json\n|\n```/g, '').trim()
      const parsed = JSON.parse(cleanJson)

      // Validar que el ID devuelto realmente existe en la lista
      if (parsed.candidatoId && candidatos.some((c) => c.id === parsed.candidatoId)) {
        return parsed.candidatoId
      }

      return null
    } catch (error) {
      console.error('[CANDIDATE_MATCHER_ERROR] Error al clasificar con Groq:', error)
      return null
    }
  }
}

export const candidateMatcher = new CandidateMatcher()
