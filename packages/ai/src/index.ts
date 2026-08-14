// Clientes de IA de Vectra
// Zhipu Flash: análisis de fidelidad de líderes (módulo ANALYTICS)
// Groq: tareas en tiempo real (notificaciones, sala de situación día E)
// Visión: extracción de datos de formularios E-14 (módulo DIA_E)

export { chatZhipu }           from './zhipu'
export { extractE14WithZhipu } from './zhipu'
export { chatGroq }            from './groq'
export { extractE14WithGroq }  from './groq'
export { extractE14WithMistral } from './mistral'
export { consensoE14 }         from './e14-consensus'
export type { ConsensoResult } from './e14-consensus'

export { E14_SYSTEM_PROMPT } from './e14-prompt'

/** Resultado de extracción de un formulario E-14 por visión IA */
export interface E14ExtractionResult {
  /**
   * `numero` es el del renglón del tarjetón, y es la identidad fiable del
   * candidato: los modelos coinciden en el número pero escriben el nombre
   * distinto. Puede venir null si el renglón no se pudo leer.
   */
  candidatos: { numero: number | null; nombre: string; votos: number | null }[]
  totalVotos: number | null
  mesaNumero: string | null
  /**
   * Nombre del puesto impreso en el encabezado del acta. Va junto a mesaNumero
   * porque el número de mesa se repite entre puestos: sin el puesto, el acta de
   * la mesa 1 de otro colegio pasa por la mesa 1 propia.
   */
  puestoNombre: string | null
  rawResponse: string // para auditoría
}
