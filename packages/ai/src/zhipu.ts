/**
 * Cliente Zhipu Flash (Z-AI): análisis de fidelidad de líderes y lectura del E-14.
 *
 * Usa la API OpenAI-compatible de Z.AI con fetch nativo — sin SDKs externos.
 *
 * Los dos modelos son los de nivel gratuito. Verificado contra la API el
 * 2026-08-14: el endpoint anterior (open.bigmodel.cn) y los modelos anteriores
 * (glm-4-flash / glm-4v-flash) responden "1211 Unknown Model", así que esta
 * integración estaba caída entera. glm-4.6v-flash responde 200.
 *
 * OJO: el nivel gratuito tiene límite de tasa (error 1302). Un día de elección,
 * con cientos de testigos transmitiendo, es esperable que parte de las llamadas
 * caigan; el consenso ya sabe degradar a una sola IA o a captura manual.
 *
 * Env var requerida: ZHIPU_API_KEY (clave global; el tenant puede traer la suya)
 */

import type { E14ExtractionResult } from './index'
import { E14_SYSTEM_PROMPT, parsearRespuestaE14 } from './e14-prompt'

const BASE_URL     = 'https://api.z.ai/api/paas/v4/chat/completions'
const MODEL        = 'glm-4.7-flash'  // texto
const VISION_MODEL = 'glm-4.6v-flash' // visión — lectura del acta E-14

interface ZhipuChoice {
  message: { role: string; content: string }
}

interface ZhipuResponse {
  choices: ZhipuChoice[]
}

/**
 * Envía un mensaje al modelo Zhipu Flash y retorna el contenido de la respuesta.
 *
 * @param systemPrompt - Instrucciones de sistema para el modelo
 * @param userMessage  - Mensaje del usuario (contexto del líder en JSON)
 * @returns Contenido de la respuesta del modelo (string)
 * @throws Error si la API key no está configurada, la API falla, o la respuesta es vacía
 */
export async function chatZhipu(
  systemPrompt: string,
  userMessage: string,
  apiKey: string | undefined = process.env.ZHIPU_API_KEY,
): Promise<string> {
  if (!apiKey) {
    throw new Error('ZHIPU_API_KEY no está configurada (ni global ni por campaña).')
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
    throw new Error(`Zhipu API error ${res.status}: ${body}`)
  }

  const data = (await res.json()) as ZhipuResponse

  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Zhipu API retornó una respuesta vacía.')
  }

  return content
}


/**
 * Extrae datos del formulario E-14 de una imagen usando Zhipu Vision.
 * Ver VISION_MODEL arriba.
 *
 * @param imageBase64 - Imagen codificada en base64
 * @param mimeType    - Tipo MIME de la imagen (image/jpeg, image/png, etc.)
 */
export async function extractE14WithZhipu(
  imageBase64: string,
  mimeType: string,
  apiKey: string | undefined = process.env.ZHIPU_API_KEY,
): Promise<E14ExtractionResult> {
  if (!apiKey) {
    throw new Error('ZHIPU_API_KEY no está configurada (ni global ni por campaña).')
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
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '(sin cuerpo)')
    throw new Error(`Zhipu Vision API error ${res.status}: ${body}`)
  }

  const data = (await res.json()) as ZhipuResponse
  const rawResponse = data.choices?.[0]?.message?.content ?? ''

  return parsearRespuestaE14(rawResponse)
}
