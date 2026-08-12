/**
 * Colores legibles sobre el color de marca del tenant.
 *
 * El tenant elige su primaryColor libremente (#e2031a, un amarillo, lo que sea)
 * y ese color se usa de fondo del sidebar y de los botones. Fijar el texto en
 * blanco funciona solo mientras la marca sea oscura: sobre un rojo saturado el
 * gris "plata" queda en 2.97:1 y sobre un amarillo el blanco es directamente
 * ilegible. Aquí se decide el texto a partir de la luminancia del fondo, no de
 * una suposición.
 *
 * Referencia de contraste: WCAG 2.1, mínimo 4.5:1 para texto normal.
 */

const CLARO  = '#ffffff'
// Negro puro, no slate-900: con slate-900 hay una franja de fondos de luminancia
// media (~0.18, los grises) donde NI blanco NI slate-900 llegan a 4.5:1. Con negro
// el peor caso posible sube a 4.58:1, así que ningún color de marca queda ilegible.
const OSCURO = '#000000'

/** Mínimo WCAG para texto normal. Por debajo de esto el texto secundario se descarta. */
const MIN_CONTRASTE = 4.5

interface Rgb { r: number; g: number; b: number }

/** Parsea "#rgb" o "#rrggbb". Devuelve null si no es un hex válido. */
function parsearHex(hex: string): Rgb | null {
  const h = hex.trim().replace(/^#/, '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

function aHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
}

/** Luminancia relativa WCAG (0 = negro, 1 = blanco). */
function luminancia({ r, g, b }: Rgb): number {
  const canal = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

/** Razón de contraste WCAG entre dos colores (1 = idénticos, 21 = negro sobre blanco). */
export function contraste(a: Rgb, b: Rgb): number {
  const [alta, baja] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (alta + 0.05) / (baja + 0.05)
}

/** Compone `frente` sobre `fondo` con opacidad `alfa`, y devuelve el color resultante. */
function componer(frente: Rgb, fondo: Rgb, alfa: number): Rgb {
  return {
    r: frente.r * alfa + fondo.r * (1 - alfa),
    g: frente.g * alfa + fondo.g * (1 - alfa),
    b: frente.b * alfa + fondo.b * (1 - alfa),
  }
}

/**
 * Color de texto legible sobre `fondo`: blanco o slate-900, el que más contraste
 * dé. Si `fondo` no es un hex válido o falta, asume la marca oscura por defecto
 * y devuelve blanco.
 */
export function textoSobre(fondo: string | null | undefined): string {
  const bg = fondo ? parsearHex(fondo) : null
  if (!bg) return CLARO
  return contraste(bg, parsearHex(CLARO)!) >= contraste(bg, parsearHex(OSCURO)!) ? CLARO : OSCURO
}

/** Variables CSS que consume el shell para pintar una superficie con el color del tenant. */
export interface VarsDeMarca extends React.CSSProperties {
  '--brand-fg':     string
  '--brand-fg-dim': string
  '--brand-hover':  string
  '--brand-border': string
}

/**
 * Estilo inline para una superficie pintada con el color del tenant: fondo más
 * las variables de texto, texto atenuado, hover y borde ya resueltas contra ese
 * fondo.
 *
 * Sin color de tenant no se fija `backgroundColor` — manda la clase por defecto
 * (granate-dark) y las variables se calculan contra ese granate.
 */
export function varsDeMarca(primaryColor: string | null | undefined): VarsDeMarca {
  const GRANATE_DARK = '#5f1e2b' // el bg-granate-dark del tema, para calcular contra él
  const bg = (primaryColor ? parsearHex(primaryColor) : null) ?? parsearHex(GRANATE_DARK)!

  const fgHex = textoSobre(aHex(bg))
  const fg    = parsearHex(fgHex)!

  // Texto secundario: el mismo color de texto pero atenuado. Si atenuarlo lo
  // deja por debajo del mínimo legible, se usa el color pleno — antes que un
  // gris bonito e ilegible, texto que se lee.
  const atenuado = componer(fg, bg, 0.78)
  const dim = contraste(atenuado, bg) >= MIN_CONTRASTE ? aHex(atenuado) : fgHex

  // El velo de hover va en la dirección del texto: sobre marca oscura aclara,
  // sobre marca clara oscurece. Un white/10 sobre un rojo saturado no se ve.
  const velo = fgHex === CLARO ? '255, 255, 255' : '15, 23, 42'

  return {
    ...(primaryColor ? { backgroundColor: primaryColor } : {}),
    '--brand-fg':     fgHex,
    '--brand-fg-dim': dim,
    '--brand-hover':  `rgba(${velo}, 0.18)`,
    '--brand-border': `rgba(${velo}, 0.22)`,
  }
}
