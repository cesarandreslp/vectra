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

/** Resultado de extracción de un formulario E-14 por visión IA */
export interface E14ExtractionResult {
  candidatos: { nombre: string; votos: number | null }[]
  totalVotos: number | null
  mesaNumero: string | null
  rawResponse: string // para auditoría
}
