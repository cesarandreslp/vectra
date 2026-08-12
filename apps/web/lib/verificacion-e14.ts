/**
 * Verificación cruzada del E-14 a TRES fuentes obligatorias:
 *
 *   1. MANUAL     — lo que el testigo digitó del acta física
 *   2. FOTO       — lo que la IA extrajo de la fotografía del acta
 *   3. REGISTRADURÍA — lo publicado oficialmente (scraping o carga manual)
 *
 * Ninguna es opcional: mientras falte una, la mesa está INCOMPLETA y no se
 * puede dar por buena. Si dos fuentes difieren, la mesa queda en DISCREPANCIA
 * y es candidata a demanda.
 *
 * Se compara CANDIDATO POR CANDIDATO, no por totales. Un trasteo de votos
 * entre dos candidatos deja el total idéntico — comparar solo totales dejaría
 * pasar justamente el fraude que esto busca detectar.
 */

export type Fuente = 'MANUAL' | 'FOTO' | 'REGISTRADURIA'

export type EstadoVerificacion =
  | 'PENDIENTE'    // no llegó ninguna fuente
  | 'INCOMPLETA'   // falta al menos una de las tres
  | 'VERIFICADO'   // las tres coinciden candidato por candidato
  | 'DISCREPANCIA' // al menos dos fuentes difieren → demandar la mesa

export interface VotoPorCandidato {
  candidateId: string
  votes:       number
}

export interface DiscrepanciaCandidato {
  candidateId: string
  /** Votos según cada fuente presente. */
  valores:     Partial<Record<Fuente, number>>
  /** Diferencia entre el mayor y el menor de los valores reportados. */
  diferencia:  number
}

export interface ResultadoVerificacion {
  estado:        EstadoVerificacion
  fuentesPresentes: Fuente[]
  fuentesFaltantes: Fuente[]
  discrepancias: DiscrepanciaCandidato[]
  /** Datos definitivos: solo se fijan si las tres coinciden. */
  datosFinales:  VotoPorCandidato[] | null
  /** Texto corto para la alerta de la sala de situación. */
  resumen:       string
}

const TODAS_LAS_FUENTES: Fuente[] = ['MANUAL', 'FOTO', 'REGISTRADURIA']

/** Normaliza a un mapa candidato→votos, sumando repetidos por si acaso. */
function aMapa(datos: VotoPorCandidato[] | null | undefined): Map<string, number> | null {
  if (!datos) return null
  const m = new Map<string, number>()
  for (const d of datos) {
    const k = d.candidateId.toLowerCase()
    m.set(k, (m.get(k) ?? 0) + d.votes)
  }
  return m
}

export function verificarTresFuentes(entradas: {
  manual?:        VotoPorCandidato[] | null
  foto?:          VotoPorCandidato[] | null
  registraduria?: VotoPorCandidato[] | null
}): ResultadoVerificacion {
  const mapas: Partial<Record<Fuente, Map<string, number>>> = {}
  const manual = aMapa(entradas.manual)
  const foto   = aMapa(entradas.foto)
  const reg    = aMapa(entradas.registraduria)
  if (manual) mapas.MANUAL = manual
  if (foto)   mapas.FOTO = foto
  if (reg)    mapas.REGISTRADURIA = reg

  const presentes = TODAS_LAS_FUENTES.filter(f => mapas[f])
  const faltantes = TODAS_LAS_FUENTES.filter(f => !mapas[f])

  if (presentes.length === 0) {
    return {
      estado: 'PENDIENTE', fuentesPresentes: [], fuentesFaltantes: TODAS_LAS_FUENTES,
      discrepancias: [], datosFinales: null,
      resumen: 'Sin transmitir.',
    }
  }

  // Comparar todo lo que haya llegado, aunque falten fuentes: una discrepancia
  // entre dos fuentes ya es motivo de alerta, no hay que esperar a la tercera.
  const candidatos = new Set<string>()
  for (const f of presentes) for (const k of mapas[f]!.keys()) candidatos.add(k)

  const discrepancias: DiscrepanciaCandidato[] = []
  for (const c of candidatos) {
    const valores: Partial<Record<Fuente, number>> = {}
    for (const f of presentes) valores[f] = mapas[f]!.get(c) ?? 0

    const nums = Object.values(valores) as number[]
    const max = Math.max(...nums)
    const min = Math.min(...nums)
    if (max !== min) discrepancias.push({ candidateId: c, valores, diferencia: max - min })
  }

  if (discrepancias.length > 0) {
    const peor = discrepancias.reduce((a, b) => (b.diferencia > a.diferencia ? b : a))
    return {
      estado: 'DISCREPANCIA', fuentesPresentes: presentes, fuentesFaltantes: faltantes,
      discrepancias, datosFinales: null,
      resumen: `${discrepancias.length} candidato(s) no cuadran entre fuentes (máx. ${peor.diferencia} voto(s)). Mesa candidata a demanda.`,
    }
  }

  if (faltantes.length > 0) {
    return {
      estado: 'INCOMPLETA', fuentesPresentes: presentes, fuentesFaltantes: faltantes,
      discrepancias: [], datosFinales: null,
      resumen: `Coincide lo recibido, pero falta: ${faltantes.join(', ')}.`,
    }
  }

  // Las tres presentes y sin diferencias.
  const finales: VotoPorCandidato[] = [...mapas.MANUAL!.entries()].map(([candidateId, votes]) => ({ candidateId, votes }))
  return {
    estado: 'VERIFICADO', fuentesPresentes: presentes, fuentesFaltantes: [],
    discrepancias: [], datosFinales: finales,
    resumen: 'Las tres fuentes coinciden.',
  }
}
