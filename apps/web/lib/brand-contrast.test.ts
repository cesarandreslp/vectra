/**
 * Chequeo del contraste sobre el color de marca del tenant.
 *
 * El caso que justifica todo esto es el primero: #e2031a, el rojo real de una
 * campaña. El gris "plata" fijo que se usaba antes quedaba en 2.97:1 sobre ese
 * rojo — texto de menú prácticamente ilegible. Lo que se comprueba aquí es que
 * ni el texto principal ni el secundario bajen de 4.5:1 sobre NINGUNA marca,
 * incluidas las claras, donde el blanco es lo que falla.
 *
 * Correr con: npx tsx lib/brand-contrast.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { textoSobre, varsDeMarca, contraste } from './brand-contrast'

const MIN = 4.5

/** Repite el parseo del módulo para poder medir desde afuera. */
function rgb(hex: string) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

const MARCAS = [
  '#e2031a', // rojo de la campaña real que destapó el problema
  '#5f1e2b', // granate por defecto de Vectra
  '#ffdd00', // amarillo: aquí el blanco es ilegible y el texto debe volverse oscuro
  '#00a859', // verde medio
  '#0f172a', // casi negro
  '#ffffff', // blanco puro: el caso extremo del lado claro
  '#7f7f7f', // gris medio, el peor caso para ambos lados
  '#8a8a8a', // la franja exacta (luminancia ~0.18) donde slate-900 se quedaba corto
]

function main() {
  for (const marca of MARCAS) {
    const fg   = textoSobre(marca)
    const vars = varsDeMarca(marca)

    // El texto principal siempre legible sobre la marca.
    const cFg = contraste(rgb(fg), rgb(marca))
    assert.ok(cFg >= MIN, `texto principal sobre ${marca}: ${cFg.toFixed(2)}:1 < ${MIN}`)

    // Y el secundario también — es el que se rompía (plata sobre rojo = 2.97:1).
    const cDim = contraste(rgb(vars['--brand-fg-dim']), rgb(marca))
    assert.ok(cDim >= MIN, `texto secundario sobre ${marca}: ${cDim.toFixed(2)}:1 < ${MIN}`)

    // El velo de hover va en la dirección del texto, si no no se ve.
    const aclara = vars['--brand-hover'].startsWith('rgba(255')
    assert.equal(aclara, fg === '#ffffff', `el hover sobre ${marca} va en la dirección equivocada`)
  }

  // Sobre una marca clara el texto NO puede seguir siendo blanco.
  assert.equal(textoSobre('#ffdd00'), '#000000')
  assert.equal(textoSobre('#e2031a'), '#ffffff')

  // Sin color de tenant no se fija fondo: manda la clase bg-granate-dark del tema.
  assert.equal(varsDeMarca(null).backgroundColor, undefined)
  assert.equal(varsDeMarca(null)['--brand-fg'], '#ffffff')

  // Un hex inválido no puede tumbar el shell: cae al comportamiento por defecto.
  assert.equal(textoSobre('no-es-un-color'), '#ffffff')
  assert.equal(varsDeMarca('#zzz')['--brand-fg'], '#ffffff')

  console.log(`OK — ${MARCAS.length} colores de marca, texto y hover legibles en todos`)
}

main()
