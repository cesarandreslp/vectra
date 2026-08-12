/**
 * Chequeo de la extracción de color del logo.
 *
 * El caso que justifica el filtro es el tercero: un logo típico de campaña es
 * mayoritariamente fondo blanco. Si se contaran todos los píxeles, el "color
 * dominante" sería blanco y la sugerencia inútil. Lo que se comprueba aquí es
 * que gane el color de marca aunque sea minoría en área.
 *
 * Correr con: npx tsx lib/color-de-logo.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { coloresDominantes } from './color-de-logo'

/** Arma un buffer RGBA a partir de una lista de [color, cuántos píxeles]. */
function lienzo(...bloques: [[number, number, number, number], number][]): Uint8ClampedArray {
  const total = bloques.reduce((n, [, c]) => n + c, 0)
  const buf = new Uint8ClampedArray(total * 4)
  let i = 0
  for (const [[r, g, b, a], veces] of bloques) {
    for (let n = 0; n < veces; n++) {
      buf[i++] = r; buf[i++] = g; buf[i++] = b; buf[i++] = a
    }
  }
  return buf
}

const ROJO   : [number, number, number, number] = [226, 3, 26, 255]   // el rojo real de la campaña
const AZUL   : [number, number, number, number] = [30, 64, 175, 255]
const BLANCO : [number, number, number, number] = [255, 255, 255, 255]
const NEGRO  : [number, number, number, number] = [0, 0, 0, 255]
const GRIS   : [number, number, number, number] = [128, 128, 128, 255]

function main() {
  // Un solo color plano: sale ese color.
  const soloRojo = coloresDominantes(lienzo([ROJO, 100]))
  assert.equal(soloRojo.length, 1)
  assert.equal(soloRojo[0], '#e2031a')

  // Dos colores: gana el más presente, pero ambos se ofrecen.
  const dos = coloresDominantes(lienzo([AZUL, 30], [ROJO, 70]))
  assert.equal(dos[0], '#e2031a')
  assert.equal(dos.length, 2)
  assert.ok(dos.includes('#1e40af'))

  // EL CASO REAL: logo con fondo blanco mayoritario y un poco de color de marca.
  // El blanco no puede ganar aunque sea el 90% del área.
  const conFondo = coloresDominantes(lienzo([BLANCO, 900], [ROJO, 100]))
  assert.equal(conFondo[0], '#e2031a', 'el fondo blanco se coló como color de marca')

  // Lo mismo con el trazo negro de un logotipo.
  const conTrazo = coloresDominantes(lienzo([BLANCO, 500], [NEGRO, 300], [ROJO, 50]))
  assert.equal(conTrazo[0], '#e2031a')

  // Transparente (PNG recortado) tampoco cuenta.
  const conAlfa = coloresDominantes(lienzo([[0, 0, 0, 0], 800], [ROJO, 40]))
  assert.equal(conAlfa[0], '#e2031a')

  // Logo en blanco y negro: no hay color saturado, pero igual se propone algo
  // del propio logo en vez de dejar al usuario sin sugerencia.
  const grises = coloresDominantes(lienzo([BLANCO, 200], [GRIS, 300]))
  assert.equal(grises.length, 1)
  assert.equal(grises[0], '#808080')

  // Logo enteramente blanco: no hay nada que proponer, y eso no puede reventar.
  assert.deepEqual(coloresDominantes(lienzo([BLANCO, 50])), [])
  assert.deepEqual(coloresDominantes(new Uint8ClampedArray(0)), [])

  // Dos rojos casi idénticos (antialias) no gastan dos sugerencias.
  const casiIguales = coloresDominantes(lienzo([ROJO, 50], [[228, 10, 30, 255], 40]))
  assert.equal(casiIguales.length, 1)

  // Se respeta el máximo pedido.
  const limitado = coloresDominantes(lienzo([ROJO, 50], [AZUL, 40], [[16, 185, 129, 255], 30]), 2)
  assert.equal(limitado.length, 2)

  console.log('OK — color de marca extraído del logo pese a fondo, trazo y transparencia')
}

main()
