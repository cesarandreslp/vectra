/**
 * Cruce del listado de testigos con la respuesta de la Registraduría.
 *
 * Flujo real del trámite:
 *   1. PROPUESTO — la campaña arma el listado (testigo + puesto + mesa) y lo envía.
 *   2. APROBADO  — la Registraduría devuelve un archivo que puede cambiar la mesa
 *      de algunos testigos o dejar por fuera a otros.
 *   3. CORREGIDO — se compara y se aceptan las correcciones; solo se modifican
 *      los testigos que cambiaron.
 *
 * El cruce es por CÉDULA (por eso el testigo debe estar vinculado a un elector:
 * ahí vive la cédula, cifrada). Se compara por su SHA-256 para no manipular el
 * número en claro más de lo necesario.
 */

export type TipoCambio =
  | 'SIN_CAMBIO'      // aprobado en la misma mesa que se propuso
  | 'MESA_CAMBIADA'   // aprobado, pero la Registraduría lo movió de mesa
  | 'RECHAZADO'       // se propuso y no aparece en el archivo aprobado
  | 'NO_RECONOCIDO'   // viene en el archivo pero no corresponde a ningún propuesto

export interface FilaAprobada {
  cedula: string
  nombre?: string
  puesto?: string
  mesa?:   number
}

export interface TestigoPropuesto {
  assignmentId:  string
  cedulaHash:    string | null // null = testigo sin elector vinculado (sin cédula)
  nombre:        string
  email:         string
  votingTableId: string
  mesaNumero:    number
  puestoNombre:  string
}

export interface Diferencia {
  tipo:          TipoCambio
  assignmentId:  string | null
  nombre:        string
  email:         string | null
  mesaActual:    number | null
  puestoActual:  string | null
  mesaAprobada:  number | null
  puestoAprobado: string | null
  /** Mesa destino ya resuelta contra la BD; null si no se pudo ubicar. */
  votingTableIdAprobado: string | null
  detalle:       string
}

export interface ResultadoComparacion {
  diferencias:   Diferencia[]
  sinCambio:     number
  mesaCambiada:  number
  rechazados:    number
  noReconocidos: number
  /** Propuestos sin cédula: no se pueden cruzar, hay que vincularlos a un elector. */
  sinCedula:     string[]
}

/**
 * ¿Esta asignación cuenta como mesa cubierta?
 *
 * Un testigo RECHAZADO por la Registraduría no puede entrar al puesto: la fila
 * se conserva para saber a quién hay que reemplazar, pero la mesa está
 * descubierta. Contarla como cubierta le hace creer a la campaña que tiene
 * puestos vigilados que en realidad va a perder.
 *
 * El equivalente en consulta es `estado: { not: 'RECHAZADO' }` — si acá se
 * agrega otro estado sin cobertura, hay que reflejarlo allá (getDashboardDiaE).
 */
export function cubreLaMesa(estado: string | null | undefined): boolean {
  return estado !== 'RECHAZADO'
}

/** Deja la cédula en solo dígitos — los archivos suelen traer puntos o espacios. */
export function normalizarCedula(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * Compara el listado propuesto contra el aprobado.
 * No toca la base de datos: devuelve el diff para que el admin lo revise antes
 * de aplicar nada. Aplicar es un paso aparte y explícito.
 */
export function compararListados(
  propuestos: TestigoPropuesto[],
  aprobadas:  FilaAprobada[],
  hashDeCedula: (cedula: string) => string,
  resolverMesa: (puesto: string | undefined, mesa: number | undefined) => { id: string; numero: number; puesto: string } | null,
): ResultadoComparacion {
  const diferencias: Diferencia[] = []
  const sinCedula = propuestos.filter(p => !p.cedulaHash).map(p => p.nombre)

  const porHash = new Map<string, TestigoPropuesto>()
  for (const p of propuestos) if (p.cedulaHash) porHash.set(p.cedulaHash, p)

  const hashesVistos = new Set<string>()

  for (const fila of aprobadas) {
    const cedula = normalizarCedula(fila.cedula)
    if (!cedula) continue
    const hash = hashDeCedula(cedula)
    const propuesto = porHash.get(hash)

    if (!propuesto) {
      diferencias.push({
        tipo: 'NO_RECONOCIDO', assignmentId: null,
        nombre: fila.nombre ?? '(sin nombre en el archivo)', email: null,
        mesaActual: null, puestoActual: null,
        mesaAprobada: fila.mesa ?? null, puestoAprobado: fila.puesto ?? null,
        votingTableIdAprobado: null,
        detalle: 'Viene en el listado aprobado pero no corresponde a ningún testigo propuesto.',
      })
      continue
    }

    hashesVistos.add(hash)
    const destino = resolverMesa(fila.puesto, fila.mesa)

    // Sin mesa legible en el archivo: se asume aprobado donde estaba.
    if (!destino) {
      diferencias.push({
        tipo: 'SIN_CAMBIO', assignmentId: propuesto.assignmentId,
        nombre: propuesto.nombre, email: propuesto.email,
        mesaActual: propuesto.mesaNumero, puestoActual: propuesto.puestoNombre,
        mesaAprobada: fila.mesa ?? null, puestoAprobado: fila.puesto ?? null,
        votingTableIdAprobado: null,
        detalle: 'Aprobado. No se pudo ubicar la mesa del archivo, se mantiene la propuesta.',
      })
      continue
    }

    if (destino.id === propuesto.votingTableId) {
      diferencias.push({
        tipo: 'SIN_CAMBIO', assignmentId: propuesto.assignmentId,
        nombre: propuesto.nombre, email: propuesto.email,
        mesaActual: propuesto.mesaNumero, puestoActual: propuesto.puestoNombre,
        mesaAprobada: destino.numero, puestoAprobado: destino.puesto,
        votingTableIdAprobado: destino.id,
        detalle: 'Aprobado en la misma mesa.',
      })
    } else {
      diferencias.push({
        tipo: 'MESA_CAMBIADA', assignmentId: propuesto.assignmentId,
        nombre: propuesto.nombre, email: propuesto.email,
        mesaActual: propuesto.mesaNumero, puestoActual: propuesto.puestoNombre,
        mesaAprobada: destino.numero, puestoAprobado: destino.puesto,
        votingTableIdAprobado: destino.id,
        detalle: `La Registraduría lo movió a la mesa ${destino.numero} de ${destino.puesto}.`,
      })
    }
  }

  // Propuestos con cédula que no aparecieron en el archivo → rechazados
  for (const p of propuestos) {
    if (!p.cedulaHash || hashesVistos.has(p.cedulaHash)) continue
    diferencias.push({
      tipo: 'RECHAZADO', assignmentId: p.assignmentId,
      nombre: p.nombre, email: p.email,
      mesaActual: p.mesaNumero, puestoActual: p.puestoNombre,
      mesaAprobada: null, puestoAprobado: null,
      votingTableIdAprobado: null,
      detalle: 'No aparece en el listado aprobado — queda rechazado y su mesa se libera.',
    })
  }

  return {
    diferencias,
    sinCambio:     diferencias.filter(d => d.tipo === 'SIN_CAMBIO').length,
    mesaCambiada:  diferencias.filter(d => d.tipo === 'MESA_CAMBIADA').length,
    rechazados:    diferencias.filter(d => d.tipo === 'RECHAZADO').length,
    noReconocidos: diferencias.filter(d => d.tipo === 'NO_RECONOCIDO').length,
    sinCedula,
  }
}
