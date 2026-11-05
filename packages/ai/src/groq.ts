/**
 * Cliente Groq para tareas de IA en tiempo real.
 *
 * Usa la API OpenAI-compatible de Groq con llama-3.3-70b-versatile.
 * Se usa fetch nativo — sin SDKs externos.
 *
 * Env var requerida: GROQ_API_KEY
 *
 * Reservado para: notificaciones inteligentes, sala de situación día E.
 */

import type { E14ExtractionResult } from './index'
import { E14_SYSTEM_PROMPT, parsearRespuestaE14 } from './e14-prompt'

const BASE_URL     = 'https://api.groq.com/openai/v1/chat/completions'
// 2026-11-05: llama-3.3-70b-versatile devuelve 404 (ya no está en la cuenta) y
// con él se caían todos los chatGroq. gpt-oss-120b es el de texto más capaz que queda.
const MODEL        = 'openai/gpt-oss-120b'

/**
 * 2026-11-05: qwen/qwen3.6-27b pasó a devolver 404 (Groq retira modelos sin
 * aviso: ya van dos). qwen3.8-27b leyó docs/e14.webp en ~1,7 s: 10 candidatos
 * y los votos suman el total del acta (121). Antes, 2026-08-14, el 3.6 había
 * coincidido voto a voto con Zhipu en esa misma acta.
 *
 * Si vuelve a caer: GET https://api.groq.com/openai/v1/models lista los vigentes.
 *
 * Es un modelo de RAZONAMIENTO: sin `reasoning_format: 'hidden'` antepone un
 * bloque <think> y el JSON no parsea. `response_format: json_object` tampoco
 * sirve acá — la API responde json_validate_failed.
 */
const VISION_MODEL = 'qwen/qwen3.8-27b'

interface GroqChoice {
  message: { role: string; content: string }
}

interface GroqResponse {
  choices: GroqChoice[]
}

/**
 * Envía un mensaje al modelo Groq y retorna el contenido de la respuesta.
 *
 * @param systemPrompt - Instrucciones de sistema para el modelo
 * @param userMessage  - Mensaje del usuario
 * @returns Contenido de la respuesta del modelo (string)
 * @throws Error si la API key no está configurada, la API falla, o la respuesta es vacía
 */
export async function chatGroq(
  systemPrompt: string,
  userMessage: string,
  apiKey: string | undefined = process.env.GROQ_API_KEY,
): Promise<string> {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY no está configurada (ni global ni por campaña).')
  }

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '(sin cuerpo)')
    throw new Error(`Groq API error ${res.status}: ${body}`)
  }

  const data = (await res.json()) as GroqResponse

  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Groq API retornó una respuesta vacía.')
  }

  return content
}


/**
 * Extrae datos del formulario E-14 de una imagen usando Groq Vision.
 * Ver VISION_MODEL arriba — incluido por qué va con el razonamiento oculto.
 *
 * @param imageBase64 - Imagen codificada en base64
 * @param mimeType    - Tipo MIME de la imagen (image/jpeg, image/png, etc.)
 */
export async function extractE14WithGroq(
  imageBase64: string,
  mimeType: string,
  apiKey: string | undefined = process.env.GROQ_API_KEY,
): Promise<E14ExtractionResult> {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY no está configurada (ni global ni por campaña).')
  }

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: E14_SYSTEM_PROMPT },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      temperature: 0.1,
      // Sin esto el modelo antepone su bloque <think> y el JSON no parsea.
      reasoning_format: 'hidden',
      max_completion_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '(sin cuerpo)')
    throw new Error(`Groq Vision API error ${res.status}: ${body}`)
  }

  const data = (await res.json()) as GroqResponse
  const rawResponse = data.choices?.[0]?.message?.content ?? ''

  return parsearRespuestaE14(rawResponse)
}
