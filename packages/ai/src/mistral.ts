/**
 * Cliente Mistral — RESPALDO de la lectura del E-14.
 *
 * No es una de las dos fuentes principales: entra solo cuando Groq o Zhipu
 * fallan, para que el consenso del acta no se quede con una sola lectura.
 * Los dos proveedores principales están en nivel gratuito con límite de tasa,
 * así que un día de elección esa caída es esperable, no excepcional.
 *
 * API OpenAI-compatible, fetch nativo — igual que groq.ts y zhipu.ts.
 *
 * Verificado contra un E-14 real (docs/e14.webp) el 2026-08-14:
 * mistral-small-latest lee las 10 filas en ~3 s, con los mismos votos que
 * Groq y Zhipu. Es el más rápido de los tres.
 *
 * Env var: MISTRAL_API_KEY (clave global; la campaña puede traer la suya)
 */

import type { E14ExtractionResult } from './index'
import { E14_SYSTEM_PROMPT, parsearRespuestaE14 } from './e14-prompt'

const BASE_URL     = 'https://api.mistral.ai/v1/chat/completions'
const VISION_MODEL = 'mistral-small-latest'

interface MistralResponse {
  choices: { message: { role: string; content: string } }[]
}


/**
 * Extrae datos del formulario E-14 de una imagen usando Mistral Vision.
 *
 * @param imageBase64 - Imagen codificada en base64
 * @param mimeType    - Tipo MIME de la imagen (image/jpeg, image/png, etc.)
 */
export async function extractE14WithMistral(
  imageBase64: string,
  mimeType: string,
  apiKey: string | undefined = process.env.MISTRAL_API_KEY,
): Promise<E14ExtractionResult> {
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY no está configurada (ni global ni por campaña).')
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
            // Mistral recibe la imagen como string, no como objeto { url }.
            { type: 'image_url', image_url: `data:${mimeType};base64,${imageBase64}` },
          ],
        },
      ],
      temperature: 0.1,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '(sin cuerpo)')
    throw new Error(`Mistral Vision API error ${res.status}: ${body}`)
  }

  const data = (await res.json()) as MistralResponse
  const rawResponse = data.choices?.[0]?.message?.content ?? ''

  return parsearRespuestaE14(rawResponse)
}
