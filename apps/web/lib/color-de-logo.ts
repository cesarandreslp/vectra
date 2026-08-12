/**
 * Colores de marca sugeridos a partir del logo de la campaña.
 *
 * Escribir un hex a mano obliga al tenant a saber cuál es su color exacto; el
 * logo que acaba de subir ya lo tiene dentro. Esto lo saca de ahí para
 * PROPONERLO — la elección sigue siendo del usuario, porque un banner con
 * varios colores no tiene un "color de marca" objetivo y elegir por él sale mal.
 *
 * La lógica de color va separada del canvas a propósito: `coloresDominantes`
 * es pura y se puede probar sin navegador (ver color-de-logo.test.ts).
 */

/** Lado del canvas al que se reduce el logo antes de leer píxeles. */
const MUESTRA = 64

/**
 * Bits que se descartan de cada canal al agrupar (4 → 16 niveles por canal).
 *
 * Se agrupa por color cuantizado y no por rango de tono: agrupar todo un tono
 * junto y promediarlo mezcla el rojo vivo de la marca con sus sombras y
 * devuelve un ladrillo apagado. Con cubetas estrechas, un color plano cae
 * entero en una y sale tal cual es.
 */
const BITS = 4

/** Fuera blancos, negros y grises: son fondo o trazo, no el color de la campaña. */
const L_MIN = 0.15
const L_MAX = 0.88
const S_MIN = 0.25

/** Dos sugerencias más cercanas que esto en RGB se ven iguales; sobra una. */
const DIST_MIN = 60

interface Hsl { h: number; s: number; l: number }

function rgbAHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0)) :
    max === gn ? ((bn - rn) / d + 2) :
                 ((rn - gn) / d + 4)
  return { h: (h * 60) % 360, s, l }
}

function aHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
}

function distancia(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

interface Cubeta { r: number; g: number; b: number; n: number }

/** Agrupa los píxeles por color cuantizado y devuelve el medio de cada grupo, del más frecuente al menos. */
function agrupar(pixeles: Uint8ClampedArray, filtrarGrises: boolean): Cubeta[] {
  const cubetas = new Map<number, Cubeta>()

  for (let i = 0; i < pixeles.length; i += 4) {
    const [r, g, b, a] = [pixeles[i], pixeles[i + 1], pixeles[i + 2], pixeles[i + 3]]
    if (a < 128) continue // transparente: no es parte del logo

    const { s, l } = rgbAHsl(r, g, b)
    if (l < L_MIN || l > L_MAX) continue
    if (filtrarGrises && s < S_MIN) continue

    const clave = ((r >> BITS) << 16) | ((g >> BITS) << 8) | (b >> BITS)
    const c = cubetas.get(clave) ?? { r: 0, g: 0, b: 0, n: 0 }
    c.r += r; c.g += g; c.b += b; c.n++
    cubetas.set(clave, c)
  }

  return [...cubetas.values()].sort((x, y) => y.n - x.n)
}

/**
 * Colores dominantes de un buffer RGBA, en hex y de más a menos presente.
 *
 * Si ningún píxel pasa el filtro de saturación (un logo en blanco y negro) se
 * repite sin ese filtro: mejor proponer un gris del propio logo que nada.
 */
export function coloresDominantes(pixeles: Uint8ClampedArray, max = 4): string[] {
  let cubetas = agrupar(pixeles, true)
  if (cubetas.length === 0) cubetas = agrupar(pixeles, false)

  const elegidos: [number, number, number][] = []
  for (const c of cubetas) {
    const medio: [number, number, number] = [c.r / c.n, c.g / c.n, c.b / c.n]
    if (elegidos.some((e) => distancia(e, medio) < DIST_MIN)) continue
    elegidos.push(medio)
    if (elegidos.length === max) break
  }
  return elegidos.map(([r, g, b]) => aHex(r, g, b))
}

/**
 * Lee el logo y devuelve sus colores dominantes. Solo navegador (usa canvas).
 *
 * Acepta el File recién elegido (sin red de por medio) o la URL de un logo ya
 * subido. Con URL puede fallar por CORS o por un SVG sin tamaño intrínseco; en
 * ese caso devuelve [] y la UI simplemente no muestra sugerencias — nunca
 * revienta el formulario por una ayuda cosmética.
 */
export async function coloresDeLogo(origen: File | string, max = 4): Promise<string[]> {
  try {
    const img = await cargarImagen(origen)
    const canvas = document.createElement('canvas')
    canvas.width = MUESTRA
    canvas.height = MUESTRA
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return []

    ctx.drawImage(img, 0, 0, MUESTRA, MUESTRA)
    return coloresDominantes(ctx.getImageData(0, 0, MUESTRA, MUESTRA).data, max)
  } catch {
    return []
  }
}

function cargarImagen(origen: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Sin esto, un logo servido desde Vercel Blob mancha el canvas y getImageData tira.
    if (typeof origen === 'string') img.crossOrigin = 'anonymous'
    const url = typeof origen === 'string' ? origen : URL.createObjectURL(origen)

    img.onload = () => {
      if (typeof origen !== 'string') URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      if (typeof origen !== 'string') URL.revokeObjectURL(url)
      reject(new Error('no se pudo leer el logo'))
    }
    img.src = url
  })
}
