/**
 * Cliente Claude (Anthropic): análisis de estrategia de campaña.
 *
 * Usa el SDK oficial. Va en streaming porque con razonamiento alto la
 * respuesta puede tardar más que el timeout de una llamada normal.
 *
 * Env var opcional: ANTHROPIC_API_KEY (clave global; el tenant puede traer la suya)
 */

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-5-5'

/**
 * Envía un mensaje a Claude y retorna el texto de la respuesta.
 *
 * @throws Error si no hay clave, si Claude declina la petición o si la respuesta viene vacía
 */
export async function chatClaude(
  systemPrompt: string,
  userMessage: string,
  apiKey: string | undefined = process.env.ANTHROPIC_API_KEY,
  effort: 'low' | 'medium' | 'high' = 'high',
): Promise<string> {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no está configurada (ni global ni por campaña).')
  }

  const client = new Anthropic({ apiKey })
  // fallbacks "default": si el clasificador de seguridad declina, la API
  // reintenta sola con otro modelo dentro de la misma llamada.
  const respuesta = await client.beta.messages.stream({
    model:         MODEL,
    max_tokens:    32000,
    betas:         ['server-side-fallback-2026-07-01'],
    fallbacks:     'default',
    output_config: { effort },
    system:        systemPrompt,
    messages:      [{ role: 'user', content: userMessage }],
  }).finalMessage()

  if (respuesta.stop_reason === 'refusal') {
    throw new Error('Claude declinó la petición.')
  }

  const texto = respuesta.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  if (!texto) throw new Error('Claude devolvió una respuesta vacía.')
  return texto
}
