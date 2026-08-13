/**
 * Chequeo de la verificación cruzada del E-14 a tres fuentes.
 *
 * El caso que justifica todo esto es el último: un trasteo de votos entre dos
 * candidatos deja el TOTAL idéntico. Comparar totales lo dejaría pasar como
 * verificado; comparar candidato por candidato lo detecta.
 *
 * Correr con: npx tsx lib/verificacion-e14.test.ts   (desde apps/web)
 */
import assert from 'node:assert/strict'
import { verificarTresFuentes } from './verificacion-e14'
import { normalizarClavesE14 } from './e14'

const acta = [
  { candidateId: 'c1', votes: 87 },
  { candidateId: 'c2', votes: 52 },
  { candidateId: 'c3', votes: 31 },
]

function main() {
  // Sin nada transmitido
  assert.equal(verificarTresFuentes({}).estado, 'PENDIENTE')

  // Solo manual: coincide consigo mismo, pero faltan dos fuentes
  const soloManual = verificarTresFuentes({ manual: acta })
  assert.equal(soloManual.estado, 'INCOMPLETA')
  assert.deepEqual(soloManual.fuentesFaltantes, ['FOTO', 'REGISTRADURIA'])
  assert.equal(soloManual.datosFinales, null, 'no debe fijar datos finales sin las tres fuentes')

  // Manual + foto iguales, falta Registraduría → sigue incompleta
  assert.equal(verificarTresFuentes({ manual: acta, foto: acta }).estado, 'INCOMPLETA')

  // Las tres coinciden → verificado y con datos finales
  const ok = verificarTresFuentes({ manual: acta, foto: acta, registraduria: acta })
  assert.equal(ok.estado, 'VERIFICADO')
  assert.equal(ok.discrepancias.length, 0)
  assert.equal(ok.datosFinales?.length, 3)

  // Una fuente difiere en un candidato → discrepancia, sin esperar la tercera
  const alterado = [
    { candidateId: 'c1', votes: 80 },
    { candidateId: 'c2', votes: 52 },
    { candidateId: 'c3', votes: 31 },
  ]
  const dif = verificarTresFuentes({ manual: acta, foto: alterado })
  assert.equal(dif.estado, 'DISCREPANCIA')
  assert.equal(dif.discrepancias.length, 1)
  assert.equal(dif.discrepancias[0].candidateId, 'c1')
  assert.equal(dif.discrepancias[0].diferencia, 7)

  // EL CASO CLAVE: trasteo de 10 votos de c1 a c2. El total es idéntico (170),
  // así que comparar totales daría "verificado". Debe salir DISCREPANCIA.
  const trasteo = [
    { candidateId: 'c1', votes: 77 },
    { candidateId: 'c2', votes: 62 },
    { candidateId: 'c3', votes: 31 },
  ]
  const sumar = (xs: { votes: number }[]) => xs.reduce((s, x) => s + x.votes, 0)
  assert.equal(sumar(acta), sumar(trasteo), 'el trasteo debe conservar el total')

  const fraude = verificarTresFuentes({ manual: acta, foto: trasteo, registraduria: acta })
  assert.equal(fraude.estado, 'DISCREPANCIA', 'un trasteo con total igual NO puede pasar como verificado')
  assert.equal(fraude.discrepancias.length, 2)

  // ── REGRESIÓN: llaves distintas según la fuente ────────────────────────────
  // El testigo y la Registraduría mandan Candidate.id; la IA que lee la foto
  // solo puede devolver el NOMBRE impreso en el acta. Sin normalizar, la
  // comparación cruza cuids contra nombres, no coincide ninguno y TODA mesa
  // fotografiada salía DISCREPANCIA con el mismo conteo en las tres fuentes.
  const candidatos = [
    { id: 'cmsq1aaa0001', name: 'Splinter Adolfo Petro Libreros' },
    { id: 'cmsq1bbb0002', name: 'Ana María Rivas' },
  ]
  const manualReal = [
    { candidateId: 'cmsq1aaa0001', votes: 87 },
    { candidateId: 'cmsq1bbb0002', votes: 52 },
    { candidateId: 'VOTOS_BLANCO', votes: 5 },
  ]
  // Tal cual sale de la IA: nombres, con tilde y en otra caja.
  const fotoCruda = [
    { candidateId: 'SPLINTER ADOLFO PETRO LIBREROS', votes: 87 },
    { candidateId: 'Ana Maria Rivas', votes: 52 },
    { candidateId: 'Votos en blanco', votes: 5 },
  ]

  // Sin normalizar: el bug que esto previene.
  assert.equal(
    verificarTresFuentes({ manual: manualReal, foto: fotoCruda, registraduria: manualReal }).estado,
    'DISCREPANCIA',
    'sin normalizar, las llaves no cruzan (este es el bug que se corrigió)',
  )

  // Normalizando la foto, que es lo que hace submitPhotoE14 al guardar.
  const fotoNorm = normalizarClavesE14(fotoCruda, candidatos)
  assert.deepEqual(fotoNorm, manualReal, 'la foto debe quedar con las mismas llaves que el acta digitada')

  const cruce = verificarTresFuentes({ manual: manualReal, foto: fotoNorm, registraduria: manualReal })
  assert.equal(cruce.estado, 'VERIFICADO', 'mismo conteo en las tres fuentes debe dar VERIFICADO')
  assert.equal(cruce.discrepancias.length, 0)
  assert.equal(cruce.datosFinales?.length, 3)

  // Normalizar no puede tapar un fraude: si la foto trae otro número, sigue cayendo.
  const fotoAlterada = normalizarClavesE14(
    [{ candidateId: 'Splinter Adolfo Petro Libreros', votes: 70 },
     { candidateId: 'Ana María Rivas', votes: 69 },
     { candidateId: 'Votos en blanco', votes: 5 }],
    candidatos,
  )
  assert.equal(
    verificarTresFuentes({ manual: manualReal, foto: fotoAlterada, registraduria: manualReal }).estado,
    'DISCREPANCIA',
    'normalizar las llaves no puede volver verificada una mesa con votos distintos',
  )

  // Un renglón que no corresponde a ningún candidato NO se descarta en silencio:
  // se conserva para que aparezca como discrepancia a revisar.
  const conIntruso = normalizarClavesE14([{ candidateId: 'Candidato Fantasma', votes: 9 }], candidatos)
  assert.deepEqual(conIntruso, [{ candidateId: 'Candidato Fantasma', votes: 9 }])

  console.log('verificacion-e14: OK')
}

main()
