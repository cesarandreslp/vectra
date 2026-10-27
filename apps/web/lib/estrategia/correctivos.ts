/**
 * Lista cerrada de correctivos del agente semanal y sus topes. Esto es lo que
 * hace segura la autonomía: el modelo propone, pero solo pasa lo que cumple
 * estas reglas. Todo trabaja con alias (L = persona, C = comuna, K = contacto),
 * que es lo único que el modelo conoce. Puro: sin base de datos.
 */

export const TIPOS = ['META_LIDER', 'META_COMUNA', 'REASIGNAR_CONTACTO', 'AVISO'] as const
export type TipoCorrectivo = (typeof TIPOS)[number]

export const TOPE_POR_SEMANA: Record<TipoCorrectivo, number> = {
  META_LIDER: 10, META_COMUNA: 10, REASIGNAR_CONTACTO: 30, AVISO: 20,
}
const CAMBIO_MAX = 0.3      // ±30 % sobre la meta actual
const PASO_MIN   = 20       // …pero siempre se permite mover 20 votos
const DIAS_MIN_REASIGNAR = 5
const AVISO_MAX_CHARS = 140

/** Lo que el modelo devuelve por cada correctivo (todos los campos, null si no aplica). */
export interface Propuesta {
  tipo:     string
  objetivo: string        // alias: L# (META_LIDER), C# (META_COMUNA), K# (REASIGNAR_CONTACTO), L# o CANDIDATO (AVISO)
  valor:    number | null // META_*: votos nuevos
  destino:  string | null // REASIGNAR_CONTACTO: L# que lo recibe
  mensaje:  string | null // AVISO
  motivo:   string
}

export interface Contexto {
  metaGlobal: number | null
  /** Líderes del plan: los únicos a los que se les puede mover la meta. */
  lideres:    Map<string, { targetVotes: number }>
  /** Personas que pueden recibir un aviso o un contacto (líderes del plan y de comuna o barrio). */
  personas:   Set<string>
  candidato:  string | null
  comunas:    Map<string, { metaVotos: number | null }>
  contactos:  Map<string, { dias: number; asignado: string | null }>
}

export type Validacion =
  | { ok: true; tipo: TipoCorrectivo; objetivo: string; antes: unknown; despues: unknown }
  | { ok: false; motivo: string }

/**
 * Valida en orden una lista de propuestas. Lleva la cuenta entre ellas: topes
 * por tipo, un solo cambio por objetivo y la suma de metas de comunas.
 */
export function validarPropuestas(propuestas: Propuesta[], ctx: Contexto): Validacion[] {
  const usados = new Map<TipoCorrectivo, number>()
  const tocados = new Set<string>()
  let sumaComunas = [...ctx.comunas.values()].reduce((s, c) => s + (c.metaVotos ?? 0), 0)

  return propuestas.map((p) => {
    const tipo = TIPOS.find((t) => t === p.tipo)
    if (!tipo) return { ok: false, motivo: `Tipo de correctivo no permitido: ${p.tipo}` }
    if ((usados.get(tipo) ?? 0) >= TOPE_POR_SEMANA[tipo]) return { ok: false, motivo: `Tope semanal de ${tipo} alcanzado (${TOPE_POR_SEMANA[tipo]})` }

    const clave = `${tipo}:${p.objetivo}`
    if (tipo !== 'AVISO' && tocados.has(clave)) return { ok: false, motivo: 'Ya hay otro correctivo sobre el mismo objetivo esta semana' }

    const r = validarUna(tipo, p, ctx, sumaComunas)
    if (r.ok) {
      usados.set(tipo, (usados.get(tipo) ?? 0) + 1)
      tocados.add(clave)
      if (tipo === 'META_COMUNA') sumaComunas += (r.despues as number) - ((r.antes as number | null) ?? 0)
    }
    return r
  })
}

function validarUna(tipo: TipoCorrectivo, p: Propuesta, ctx: Contexto, sumaComunas: number): Validacion {
  switch (tipo) {
    case 'META_LIDER': {
      const lider = ctx.lideres.get(p.objetivo)
      if (!lider) return { ok: false, motivo: `${p.objetivo} no es un líder del plan` }
      const valor = votos(p.valor)
      if (valor === null) return { ok: false, motivo: 'La meta debe ser un entero de 0 o más' }
      const antes = lider.targetVotes
      if (antes > 0) {
        if (!dentroDelTope(antes, valor)) return { ok: false, motivo: `Cambio de ${antes} a ${valor} supera el ±30 % semanal` }
      } else {
        // Primera meta: no más de 1,5 veces la parte que le tocaría de la meta global.
        if (!ctx.metaGlobal) return { ok: false, motivo: 'Sin meta global no se asignan metas nuevas' }
        const techo = Math.ceil((1.5 * ctx.metaGlobal) / Math.max(1, ctx.lideres.size))
        if (valor > techo) return { ok: false, motivo: `Primera meta de ${valor} supera el techo de ${techo}` }
      }
      if (valor === antes) return { ok: false, motivo: 'La meta no cambia' }
      return { ok: true, tipo, objetivo: p.objetivo, antes, despues: valor }
    }

    case 'META_COMUNA': {
      const comuna = ctx.comunas.get(p.objetivo)
      if (!comuna) return { ok: false, motivo: `${p.objetivo} no es una comuna` }
      if (!ctx.metaGlobal) return { ok: false, motivo: 'Sin meta global no se reparten metas por comuna' }
      const valor = votos(p.valor)
      if (valor === null) return { ok: false, motivo: 'La meta debe ser un entero de 0 o más' }
      const antes = comuna.metaVotos ?? 0
      if (antes > 0 && !dentroDelTope(antes, valor)) return { ok: false, motivo: `Cambio de ${antes} a ${valor} supera el ±30 % semanal` }
      if (antes === 0 && valor > ctx.metaGlobal) return { ok: false, motivo: 'Una comuna no puede pedir más que la meta global' }
      if (valor === antes) return { ok: false, motivo: 'La meta no cambia' }
      const nuevaSuma = sumaComunas - antes + valor
      const holgura = Math.max(Math.abs(sumaComunas - ctx.metaGlobal), 0.05 * ctx.metaGlobal)
      if (Math.abs(nuevaSuma - ctx.metaGlobal) > holgura) {
        return { ok: false, motivo: `La suma de comunas quedaría en ${nuevaSuma}, más lejos de la meta global (${ctx.metaGlobal})` }
      }
      return { ok: true, tipo, objetivo: p.objetivo, antes: comuna.metaVotos, despues: valor }
    }

    case 'REASIGNAR_CONTACTO': {
      const contacto = ctx.contactos.get(p.objetivo)
      if (!contacto) return { ok: false, motivo: `${p.objetivo} no es un contacto pendiente` }
      if (contacto.dias < DIAS_MIN_REASIGNAR) return { ok: false, motivo: `Lleva ${contacto.dias} días; se reasigna desde ${DIAS_MIN_REASIGNAR}` }
      if (!p.destino || !ctx.personas.has(p.destino)) return { ok: false, motivo: `Destino ${p.destino ?? '(vacío)'} no es un líder válido` }
      if (p.destino === contacto.asignado) return { ok: false, motivo: 'Ya está asignado a ese líder' }
      return { ok: true, tipo, objetivo: p.objetivo, antes: contacto.asignado, despues: p.destino }
    }

    case 'AVISO': {
      const destino = p.objetivo === 'CANDIDATO' ? ctx.candidato : p.objetivo
      if (!destino || !(ctx.personas.has(destino) || destino === ctx.candidato)) return { ok: false, motivo: `Destino ${p.objetivo} no es válido` }
      const mensaje = p.mensaje?.trim() ?? ''
      if (!mensaje || mensaje.length > AVISO_MAX_CHARS) return { ok: false, motivo: `El aviso debe tener entre 1 y ${AVISO_MAX_CHARS} caracteres` }
      return { ok: true, tipo, objetivo: destino, antes: null, despues: mensaje }
    }
  }
}

function votos(v: number | null): number | null {
  return v !== null && Number.isInteger(v) && v >= 0 ? v : null
}

function dentroDelTope(antes: number, despues: number): boolean {
  return Math.abs(despues - antes) <= Math.max(CAMBIO_MAX * antes, PASO_MIN)
}

/** Deshacer solo si nadie cambió el valor después del agente. */
export function puedeDeshacer(actual: unknown, despues: unknown): boolean {
  return JSON.stringify(actual ?? null) === JSON.stringify(despues ?? null)
}
