/**
 * Número entero → letras en español, como se escriben los votos en las actas
 * electorales (E-14, E-24, E-26): "ciento veintiuno", "mil doscientos".
 * Hasta 999.999.999, que sobra para cualquier escrutinio municipal.
 */
const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const DECENAS  = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function hasta999(n: number): string {
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100), resto = n % 100
  const partes: string[] = []
  if (c > 0) partes.push(CENTENAS[c])
  if (resto > 0) {
    if (resto < 30) partes.push(UNIDADES[resto])
    else partes.push(DECENAS[Math.floor(resto / 10)] + (resto % 10 ? ` y ${UNIDADES[resto % 10]}` : ''))
  }
  return partes.join(' ')
}

/** "uno" se apocopa delante de mil/millones: "veintiún mil", "un millón". */
function apocopar(texto: string): string {
  return texto.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')
}

export function numeroALetras(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999) throw new Error(`Fuera de rango: ${n}`)
  if (n === 0) return 'cero'

  const millones = Math.floor(n / 1_000_000)
  const miles    = Math.floor((n % 1_000_000) / 1000)
  const unidades = n % 1000
  const partes: string[] = []

  if (millones === 1) partes.push('un millón')
  else if (millones > 1) partes.push(`${apocopar(hasta999(millones))} millones`)
  if (miles === 1) partes.push('mil')
  else if (miles > 1) partes.push(`${apocopar(hasta999(miles))} mil`)
  if (unidades > 0) partes.push(hasta999(unidades))

  return partes.join(' ')
}
