/**
 * Agente conversacional: lo que no toca la base, para poder probarlo solo.
 * El modelo PROPONE (respuesta + acciones en JSON); este archivo decide qué
 * de eso se acepta. Lista cerrada: lo que no está acá no lo puede hacer.
 */

/** Temas de conversación. Cerrados para poder sumarlos por zona. */
export const TEMAS = [
  'seguridad', 'empleo', 'salud', 'educacion', 'vias', 'servicios_publicos',
  'medio_ambiente', 'vivienda', 'movilidad', 'deporte_cultura', 'campo',
  'corrupcion', 'programa_social', 'otro',
] as const
export type Tema = (typeof TEMAS)[number]

export type Apoyo = 'FRIO' | 'TIBIO' | 'CALIENTE'

export interface Registro {
  nombre:     string | null
  barrio:     string | null
  intereses:  string[]
  apoyo:      Apoyo | null
  voluntario: boolean
}

export interface SalidaAgente {
  respuesta:    string
  autorizacion: 'ACEPTA' | 'RECHAZA' | null
  registro:     Registro | null
  temas:        Tema[]
  escalar:      string | null // motivo
}

export interface Conocimiento {
  propuestas: string; biografia: string; tono: string; lineamientos: string; textoAutorizacion: string
}

export interface Contexto {
  botName:      string
  candidato:    string
  cargo:        string | null // "la Alcaldía de Guadalajara de Buga"
  fechaEleccion: string | null
  autorizacion: 'PENDIENTE' | 'AUTORIZO' | 'RECHAZO'
  conocimiento: Conocimiento
}

const MAX_RESPUESTA = 1000
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Lo que el modelo devolvió → lo que se acepta. Nunca lanza: si no parsea, no hay acciones. */
export function interpretarSalida(crudo: string): SalidaAgente | null {
  const ini = crudo.indexOf('{'), fin = crudo.lastIndexOf('}')
  if (ini < 0 || fin <= ini) return null
  let o: any
  try { o = JSON.parse(crudo.slice(ini, fin + 1)) } catch { return null }

  const respuesta = texto(o?.respuesta, MAX_RESPUESTA)
  if (!respuesta) return null

  const r = o.registro && typeof o.registro === 'object' ? o.registro : null
  const registro: Registro | null = r ? {
    nombre:     texto(r.nombre, 80) || null,
    barrio:     texto(r.barrio, 80) || null,
    intereses:  (Array.isArray(r.intereses) ? r.intereses : []).map((i: unknown) => texto(i, 40)).filter(Boolean).slice(0, 5),
    apoyo:      ['FRIO', 'TIBIO', 'CALIENTE'].includes(r.apoyo) ? r.apoyo : null,
    voluntario: r.voluntario === true,
  } : null
  const vacio = registro && !registro.nombre && !registro.barrio && !registro.intereses.length && !registro.apoyo && !registro.voluntario

  return {
    respuesta,
    autorizacion: o.autorizacion === 'ACEPTA' || o.autorizacion === 'RECHAZA' ? o.autorizacion : null,
    registro:     vacio ? null : registro,
    temas:        [...new Set((Array.isArray(o.temas) ? o.temas : []).filter((t: unknown): t is Tema => TEMAS.includes(t as Tema)))].slice(0, 3) as Tema[],
    escalar:      o.escalar ? texto(typeof o.escalar === 'object' ? o.escalar.motivo : o.escalar, 200) || 'Pidió atención de una persona' : null,
  }
}

/** Saludo que va antes de la primera respuesta: el agente se identifica siempre como IA. */
export function presentacion(ctx: Pick<Contexto, 'botName' | 'candidato'>): string {
  return `Hola, soy ${ctx.botName}, el asistente de inteligencia artificial de la campaña de ${ctx.candidato}. No soy ${ctx.candidato} ni una persona.`
}

const ESTADO_DATOS: Record<Contexto['autorizacion'], (t: string) => string> = {
  PENDIENTE: (t) => `Esta persona TODAVÍA NO autoriza el tratamiento de sus datos. Antes de pedir o anotar cualquier dato suyo (nombre, barrio, intereses, si quiere ser voluntario), pídele autorización con este texto: «${t}». Si acepta con claridad, "autorizacion": "ACEPTA"; si se niega, "RECHAZA". No es obligatorio: si no quiere, sigue conversando sin pedir datos. Mientras no acepte, "registro" va en null.`,
  AUTORIZO:  () => 'Ya autorizó el tratamiento de sus datos. En "registro" pon TODO lo que sabes de la persona por la conversación completa, no solo por el último mensaje. Para anotarla hace falta al menos su nombre: pídeselo con naturalidad si no lo ha dicho, y también su barrio o vereda.',
  RECHAZO:   () => 'No autorizó el tratamiento de sus datos: no le pidas ni anotes datos ("registro" en null). Sí puedes seguir conversando.',
}

export function armarPrompt(ctx: Contexto): string {
  const c = ctx.conocimiento
  return `Eres ${ctx.botName}, el asistente de inteligencia artificial de la campaña de ${ctx.candidato}${ctx.cargo ? ` a ${ctx.cargo}` : ''}. Conversas por WhatsApp con ciudadanos en nombre de la campaña.

REGLAS QUE NO SE ROMPEN
- Eres un asistente de IA. Nunca digas que eres ${ctx.candidato} ni una persona; si te lo preguntan, dilo claro.
- Habla solo con lo que está en PROPUESTAS y BIOGRAFÍA. Si te preguntan algo que no está ahí, dilo y ofrece que alguien del equipo le escriba; escala solo si la persona acepta esa oferta.
- Cumple los LINEAMIENTOS.
- Nunca ofrezcas dinero, regalos, empleos ni favores a cambio del voto. No ataques a otros candidatos. No inventes datos.
- Mensajes cortos de WhatsApp: máximo 4 frases. Español de Colombia. Tono: ${c.tono || 'cercano y respetuoso'}.
- Escala a una persona del equipo ("escalar") si pide hablar con alguien, si hay una queja grave, amenaza, violencia, emergencia, riesgo para alguien, una denuncia, un periodista, o un tema legal o electoral delicado. Igual le respondes con amabilidad que alguien del equipo lo va a contactar.
- Cuando venga al caso, invita a seguir la campaña, a ser voluntario, a los eventos y a votar${ctx.fechaEleccion ? ` el ${ctx.fechaEleccion}` : ''}.
- La opinión política es un dato sensible: nunca la exijas.

DATOS PERSONALES (Ley 1581 de 2012)
${ESTADO_DATOS[ctx.autorizacion](c.textoAutorizacion)}

PROPUESTAS
${c.propuestas}

BIOGRAFÍA
${c.biografia}

LINEAMIENTOS
${c.lineamientos || '(ninguno adicional)'}

FORMATO: responde SOLO un objeto JSON, sin texto antes ni después:
{"respuesta": "tu mensaje", "autorizacion": "ACEPTA" | "RECHAZA" | null, "registro": {"nombre": string|null, "barrio": string|null, "intereses": string[], "apoyo": "FRIO"|"TIBIO"|"CALIENTE"|null, "voluntario": boolean} | null, "temas": string[], "escalar": {"motivo": string} | null}
- "temas": de qué habla la persona en su ÚLTIMO mensaje, de 0 a 3, solo de esta lista: ${TEMAS.join(', ')}.
- "apoyo": FRIO si no apoya o duda mucho, TIBIO si le interesa, CALIENTE si dice que votará por ${ctx.candidato}.
- "voluntario": true solo si dice que quiere ayudar o ser voluntario.`
}

export interface LineaHistorial { entrante: boolean; texto: string }

/** El historial como texto para el modelo: los últimos mensajes, el más reciente al final. */
export function transcripcion(historial: LineaHistorial[]): string {
  return historial.map((m) => `${m.entrante ? 'Ciudadano' : 'Asistente'}: ${m.texto}`).join('\n')
}

/** Para cruzar "el barrio que dijo" con Neighborhood.name: sin tildes, minúsculas, sin "barrio". */
export function normalizarLugar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^(barrio|vereda|b\/)\s+/, '').replace(/\s+/g, ' ').trim()
}
