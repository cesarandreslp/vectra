import { createHmac, timingSafeEqual } from 'crypto'

/**
 * ¿El webhook lo firmó Meta? Meta manda `X-Hub-Signature-256: sha256=<hex>`,
 * el HMAC-SHA256 del cuerpo CRUDO con el App Secret de la app. Hay que firmar
 * el texto tal cual llegó: re-serializar el JSON cambia los bytes.
 */
export function firmaValida(cuerpo: string, encabezado: string | null, appSecret: string): boolean {
  if (!encabezado?.startsWith('sha256=')) return false
  const esperada = createHmac('sha256', appSecret).update(cuerpo, 'utf8').digest()
  const recibida = Buffer.from(encabezado.slice('sha256='.length), 'hex')
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada)
}
