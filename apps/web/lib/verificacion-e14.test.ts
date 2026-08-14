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
import { normalizarClavesE14, actaEsDeLaMesa, actaEsDelPuesto } from './e14'

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
    { id: 'cmsq1aaa0001', name: 'Splinter Adolfo Petro Libreros', order: 1 },
    { id: 'cmsq1bbb0002', name: 'Ana María Rivas',                order: 2 },
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

  // ── REGRESIÓN: el nombre mal escrito no puede romper el cruce ──────────────
  // Verificado contra las APIs: los modelos coinciden en los números del
  // tarjetón pero escriben distinto los nombres ("OYTHER" / "Oytther",
  // "ELIEZER" / "ELIECER"). Cruzando por nombre eso daba discrepancias falsas;
  // el número del renglón tiene que mandar sobre el nombre.
  const conNombreMalEscrito = normalizarClavesE14(
    [{ candidateId: 'ESPLINTER ADOLFO PEDRO LIBRERO', votes: 87, numero: 1 },
     { candidateId: 'Ana Marilla Ribas',              votes: 52, numero: 2 },
     { candidateId: 'Votos en blanco',                votes: 5,  numero: null }],
    candidatos,
  )
  assert.deepEqual(conNombreMalEscrito, manualReal,
    'el número del tarjetón debe cruzar aunque la IA escriba mal el nombre')

  // Y al revés: sin número legible, el nombre sigue sirviendo de respaldo.
  const sinNumero = normalizarClavesE14(
    [{ candidateId: 'SPLINTER ADOLFO PETRO LIBREROS', votes: 87, numero: null }],
    candidatos,
  )
  assert.deepEqual(sinNumero, [{ candidateId: 'cmsq1aaa0001', votes: 87 }])

  // Un candidato sin número de tarjetón asignado (order 0, el valor por
  // defecto) no puede capturar los renglones que la IA no supo numerar.
  const sinTarjeton = [{ id: 'cmsq1ccc0003', name: 'Aún Sin Número', order: 0 }]
  assert.deepEqual(
    normalizarClavesE14([{ candidateId: 'Otro', votes: 3, numero: 0 }], sinTarjeton),
    [{ candidateId: 'Otro', votes: 3 }],
    'order 0 es "sin número asignado", no un número de tarjetón real',
  )

  // ── El acta fotografiada tiene que ser la de esta mesa ────────────────────
  // El E-14 lleva impreso su número; la IA lo devuelve como texto con relleno.
  assert.equal(actaEsDeLaMesa('014', 14), true,  'los ceros a la izquierda no cuentan')
  assert.equal(actaEsDeLaMesa('14', 14),  true)
  assert.equal(actaEsDeLaMesa(' 7 ', 7),  true,  'los espacios no cuentan')
  assert.equal(actaEsDeLaMesa('Mesa 007', 7), true, 'el número puede venir con texto alrededor')
  assert.equal(actaEsDeLaMesa('014', 7),  false, 'acta de otra mesa: eso es lo que hay que cazar')

  // "No se sabe" NO es "no coincide": marcar como cruzada un acta que salió
  // borrosa sería peor que no marcar nada.
  assert.equal(actaEsDeLaMesa(null, 7),        null)
  assert.equal(actaEsDeLaMesa('', 7),          null)
  assert.equal(actaEsDeLaMesa('ilegible', 7),  null)

  // ── …y del puesto, porque el número de mesa se repite entre puestos ───────
  // Este es el hueco que el número de mesa solo NO cierra: la mesa 1 existe en
  // los 51 puestos del municipio.
  assert.equal(
    actaEsDelPuesto('COLEGIO SANTA LIBRADA', 'Escuela Jhon F. Kennedy'),
    false,
    'mesa 1 del puesto de al lado: eso es lo que hay que cazar',
  )

  // El OCR nunca devuelve el nombre igual que la BD: abrevia, pierde tildes,
  // cambia el genérico. Con que compartan UNA palabra distintiva, pasa.
  assert.equal(actaEsDelPuesto('INST EDUC JHON F KENNEDY', 'Escuela Jhon F. Kennedy'), true)
  assert.equal(actaEsDelPuesto('ESCUELA SAN JOSE', 'Colegio San José'), true, 'sin tildes')
  assert.equal(actaEsDelPuesto('I.E. SANTA LIBRADA SEDE B', 'Colegio Santa Librada'), true)

  // Las palabras de relleno no alcanzan para dar por bueno un puesto: si
  // "colegio" contara, cualquier colegio pasaría por cualquier otro.
  assert.equal(actaEsDelPuesto('COLEGIO SAN ANTONIO', 'Colegio San José'), false)

  // "No se sabe" tampoco es "no coincide", igual que con la mesa.
  assert.equal(actaEsDelPuesto(null, 'Colegio San José'),        null)
  assert.equal(actaEsDelPuesto('PUESTO', 'Colegio San José'),    null, 'solo relleno: no dice nada')
  assert.equal(actaEsDelPuesto('COLEGIO SAN JOSE', ''),          null, 'sin puesto en el sistema')

  console.log('verificacion-e14: OK')
}

main()
