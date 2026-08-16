/**
 * Agrupa y renderiza los resultados de un set de preguntas — reusado por
 * /encuestas/resultados (agregado del tenant) y /encuestas/campanas/[id]
 * (una sola campaña). FREE_TEXT se agrupa por candidato (matcher IA);
 * BOOLEAN/SINGLE_CHOICE no tienen candidato así que se agrupan por el texto
 * guardado (SI/NO, o el texto de la opción elegida).
 */

interface Pregunta {
  id: string
  text: string
  type: string
  surveyCargoId: string
}

interface Candidato {
  id: string
  name: string
  surveyCargoId: string
}

interface ResultadosPorPreguntaProps {
  rawResponsesGrouped: { surveyPreguntaId: string; surveyCandidatoId: string | null; _count: { id: number } }[]
  rawResponsesByText: { surveyPreguntaId: string; text: string; _count: { id: number } }[]
  metadata: { preguntas: Pregunta[]; candidatos: Candidato[] }
  vacio: string
}

export function ResultadosPorPregunta({ rawResponsesGrouped, rawResponsesByText, metadata, vacio }: ResultadosPorPreguntaProps) {
  const resultsByPregunta: Record<string, {
    pregunta: Pregunta,
    candidatos: { id: string, name: string, count: number }[],
    total: number
  }> = {}

  metadata.preguntas.forEach((p) => {
    const esCerradaSinCandidato = p.type !== 'FREE_TEXT'
    resultsByPregunta[p.id] = {
      pregunta: p,
      candidatos: esCerradaSinCandidato
        ? []
        : metadata.candidatos
            .filter((c) => c.surveyCargoId === p.surveyCargoId)
            .map((c) => ({ id: c.id, name: c.name, count: 0 })),
      total: 0,
    }
    if (!esCerradaSinCandidato) {
      resultsByPregunta[p.id].candidatos.push({ id: 'null', name: 'Blanco / No identificado', count: 0 })
    }
  })

  rawResponsesGrouped.forEach((group) => {
    const rbp = resultsByPregunta[group.surveyPreguntaId]
    if (rbp && rbp.pregunta.type === 'FREE_TEXT') {
      const cId = group.surveyCandidatoId || 'null'
      const cand = rbp.candidatos.find((c) => c.id === cId)
      if (cand) {
        cand.count += group._count.id
        rbp.total += group._count.id
      }
    }
  })

  rawResponsesByText.forEach((group) => {
    const rbp = resultsByPregunta[group.surveyPreguntaId]
    if (!rbp || rbp.pregunta.type === 'FREE_TEXT') return

    // Opción múltiple: el texto trae varias opciones unidas (ver SEP_MULTIPLE en
    // pwa/encuestas/actions) — se cuenta cada una por separado. El total suma
    // RESPONDENTES (una vez por fila), no selecciones, así que puede pasar 100%.
    const partes = rbp.pregunta.type === 'MULTIPLE_CHOICE' ? group.text.split('\n') : [group.text]
    for (const parte of partes) {
      const etiqueta = parte === 'SI' ? 'Sí' : parte === 'NO' ? 'No' : parte
      let opcion = rbp.candidatos.find((c) => c.name === etiqueta)
      if (!opcion) {
        opcion = { id: `texto-${etiqueta}`, name: etiqueta, count: 0 }
        rbp.candidatos.push(opcion)
      }
      opcion.count += group._count.id
    }
    rbp.total += group._count.id
  })

  const resultados = Object.values(resultsByPregunta)

  if (resultados.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center text-slate-500 italic">
        {vacio}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {resultados.map((resultado) => (
        <div key={resultado.pregunta.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-2">{resultado.pregunta.text}</h2>
          <div className="text-xs text-slate-500 mb-6 uppercase tracking-wider font-semibold">Total respuestas: {resultado.total}</div>

          <div className="space-y-4">
            {resultado.candidatos.sort((a, b) => b.count - a.count).map((c) => {
              const percent = resultado.total > 0 ? Math.round((c.count / resultado.total) * 100) : 0
              return (
                <div key={c.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{c.name}</span>
                    <span className="font-bold text-slate-900">{c.count} ({percent}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full ${c.id === 'null' ? 'bg-slate-400' : 'bg-granate'}`} style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
