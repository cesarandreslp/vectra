/**
 * Reglas del formulario E-14 (acta de escrutinio de la Registraduría).
 * Vive fuera de dia-e/actions.ts porque ese archivo es 'use server' y solo
 * puede exportar funciones async.
 */

/**
 * Cargos uninominales: el tarjetón es de foto + agrupación, y el testigo
 * identifica el renglón del acta por la cara y el logo, no leyendo el nombre.
 * Por eso ahí foto y agrupación son obligatorias, no opcionales.
 * En cuerpos colegiados (concejo, asamblea, cámara, senado) el tarjetón va por
 * lista de partido, así que la foto individual no aplica igual.
 */
const CARGOS_UNINOMINALES = ['ALCALDE', 'GOBERNADOR', 'PRESIDENTE'] as const

export function requiereFotoYAgrupacion(cargo: string | null | undefined): boolean {
  return Boolean(cargo && (CARGOS_UNINOMINALES as readonly string[]).includes(cargo))
}

/** Etiqueta del cargo tal como encabeza el acta física ("ALCALDE", "GOBERNADOR"…). */
export function tituloActa(cargo: string | null | undefined): string {
  return cargo ?? 'CORPORACIÓN'
}

export interface Nivelacion {
  e11:         number // TOTAL VOTANTES FORMULARIO E-11
  urna:        number // TOTAL VOTOS DEL CARGO EN LA URNA
  incinerados: number // TOTAL VOTOS INCINERADOS
}

export interface ChequeoNivelacion {
  ok:      boolean
  errores: string[]
  avisos:  string[]
}

/**
 * Valida el bloque "NIVELACIÓN DE LA MESA" contra los votos digitados.
 *
 * - La suma de votos digitados DEBE igualar los votos en la urna: si no, el
 *   testigo transcribió mal y no tiene sentido transmitir.
 * - Votantes E-11 vs votos en urna deberían coincidir; si no, el acta física
 *   tiene una inconsistencia real (sobran o faltan votos en la urna) que se
 *   reclama en la mesa. Es aviso, no bloqueo: el testigo transmite lo que dice
 *   el acta, no lo que debería decir.
 */
export function validarNivelacion(sumaDigitada: number, n: Nivelacion): ChequeoNivelacion {
  const errores: string[] = []
  const avisos:  string[] = []

  if (n.urna <= 0) {
    errores.push('Falta el total de votos en la urna (bloque de nivelación).')
  } else if (sumaDigitada !== n.urna) {
    const dif = Math.abs(sumaDigitada - n.urna)
    errores.push(`La suma digitada (${sumaDigitada}) no coincide con los votos en la urna (${n.urna}). Diferencia: ${dif}.`)
  }

  if (n.e11 > 0 && n.urna > 0 && n.e11 !== n.urna) {
    const dif = n.urna - n.e11
    avisos.push(
      dif > 0
        ? `Hay ${dif} voto(s) MÁS en la urna que votantes en el E-11 — inconsistencia del acta, déjala reclamada en la mesa.`
        : `Hay ${Math.abs(dif)} voto(s) MENOS en la urna que votantes en el E-11 — inconsistencia del acta, déjala reclamada en la mesa.`,
    )
  }

  return { ok: errores.length === 0, errores, avisos }
}

// ── Llaves de candidato en las tres fuentes ──────────────────────────────────

/** Para comparar nombres: minúsculas, sin tildes, sin espacios repetidos. */
function clave(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * ¿El acta fotografiada es la de esta mesa?
 *
 * El E-14 lleva impreso su número de mesa y la IA lo lee, pero llega como texto
 * y con relleno ("014", "Mesa 7", " 07 "), mientras que la mesa del sistema es
 * un entero. Se comparan los dígitos.
 *
 * Devuelve `null` cuando no se puede saber — la IA no leyó el número o lo que
 * leyó no tiene dígitos. Un "no se sabe" NO es un "no coincide": marcar como
 * cruzada un acta que simplemente salió borrosa sería peor que no marcar nada.
 */
export function actaEsDeLaMesa(
  actaMesaNumero: string | null | undefined,
  mesaDelSistema: number,
): boolean | null {
  if (!actaMesaNumero) return null
  const digitos = actaMesaNumero.replace(/\D/g, '')
  if (digitos === '') return null
  return parseInt(digitos, 10) === mesaDelSistema
}

/**
 * Palabras que encabezan medio directorio de puestos y no distinguen a ninguno.
 * Sin quitarlas, "Colegio San José" y "Colegio San Antonio" comparten dos de
 * tres palabras y nada se podría separar.
 */
const RELLENO_PUESTO = new Set([
  'institucion', 'institucional', 'educativa', 'educativo', 'instituto', 'colegio',
  'escuela', 'liceo', 'centro', 'sede', 'puesto', 'normal', 'superior', 'tecnico',
  'tecnica', 'iglesia', 'salon', 'comunal', 'san', 'santa', 'nuestra', 'senora',
  'de', 'del', 'la', 'el', 'los', 'las', 'y',
])

/** Palabras con las que un puesto se distingue de otro. */
function tokensPuesto(nombre: string | null | undefined): Set<string> {
  if (!nombre) return new Set()
  return new Set(
    clave(nombre)
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      // Menos de 3 letras es ruido de OCR o una letra de sede, no un nombre.
      .filter(t => t.length >= 3 && !RELLENO_PUESTO.has(t)),
  )
}

/**
 * ¿El acta fotografiada es la de ESTE puesto?
 *
 * Hace falta además de `actaEsDeLaMesa` porque el número de mesa se repite entre
 * puestos: en un municipio con decenas de puestos hay muchas "mesa 1", y sin
 * mirar el puesto el acta de la mesa 1 del colegio de al lado pasa como propia.
 *
 * ponytail: heurística de solapamiento — solo marca cuando los dos nombres no
 * comparten NI UNA palabra distintiva. Techo conocido: no separa puestos de
 * nombre parecido ("Sede A" vs "Sede B" del mismo colegio). Es el lado seguro
 * del error: el día de la elección una alerta falsa quema la confianza en TODAS
 * las alertas. Si algún día el puesto tiene código DIVIPOLA propio en
 * VotingStation, comparar por código y borrar esto.
 *
 * `null` = no se puede saber (la IA no leyó el puesto, o lo que leyó no dejó
 * ninguna palabra distintiva). Un "no se sabe" no es un "no coincide".
 */
export function actaEsDelPuesto(
  actaPuestoNombre: string | null | undefined,
  puestoDelSistema: string,
): boolean | null {
  const acta   = tokensPuesto(actaPuestoNombre)
  const propio = tokensPuesto(puestoDelSistema)
  if (acta.size === 0 || propio.size === 0) return null

  for (const t of acta) if (propio.has(t)) return true
  return false
}

/** Filas del acta que no son un candidato del tarjetón. */
export const VOTOS_BLANCO = 'VOTOS_BLANCO'
export const VOTOS_NULOS  = 'VOTOS_NULOS'

/**
 * Lleva los votos de una fuente a la MISMA llave que usan las otras dos.
 *
 * El testigo y la carga de la Registraduría mandan `Candidate.id`; la IA que lee
 * la foto devuelve lo que está impreso en el acta. Sin traducir eso a id, la
 * verificación cruzada compara cuids contra nombres, no cruza ninguno y declara
 * DISCREPANCIA aunque las tres fuentes traigan exactamente lo mismo.
 *
 * Orden de resolución, del más firme al más frágil:
 *   1. Ya viene con `Candidate.id` — nada que hacer.
 *   2. NÚMERO del renglón contra `Candidate.order` (el número del tarjetón).
 *      Es el cruce bueno: los modelos leen igual las cifras y difieren en la
 *      ortografía de los nombres ("OYTHER" / "Oytther").
 *   3. Nombre normalizado, para cuando el número no se pudo leer.
 *   4. Votos en blanco / nulos, que no son candidatos del tarjetón.
 *
 * Un renglón que no corresponda a ningún candidato conocido se deja tal cual:
 * es preferible que salga como discrepancia a revisar que desaparecer un voto.
 */
export function normalizarClavesE14(
  datos:      { candidateId: string; votes: number; numero?: number | null }[],
  candidatos: { id: string; name: string; order: number }[],
): { candidateId: string; votes: number }[] {
  const ids       = new Set(candidatos.map(c => c.id))
  const porNombre = new Map(candidatos.map(c => [clave(c.name), c.id]))
  // order 0 es el valor por defecto de un candidato al que todavía no le
  // pusieron número de tarjetón: no identifica a nadie, no sirve para cruzar.
  const porNumero = new Map(candidatos.filter(c => c.order > 0).map(c => [c.order, c.id]))

  return datos.map(({ candidateId, votes, numero }) => {
    if (ids.has(candidateId)) return { candidateId, votes }

    if (numero != null) {
      const porNro = porNumero.get(numero)
      if (porNro) return { candidateId: porNro, votes }
    }

    const k  = clave(candidateId)
    const id = porNombre.get(k)
    if (id) return { candidateId: id, votes }

    if (k.includes('blanco')) return { candidateId: VOTOS_BLANCO, votes }
    if (k.includes('nulo'))   return { candidateId: VOTOS_NULOS,  votes }

    return { candidateId, votes }
  })
}
