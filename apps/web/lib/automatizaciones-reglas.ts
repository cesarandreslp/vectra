/**
 * Automatizaciones: las reglas que no tocan la base (para probarlas solas).
 * Ver lib/automatizaciones.ts para la cola y el envío.
 */

export const CANALES_AUTOMATIZACION = ['PUSH', 'WHATSAPP'] as const
export const TRIGGERS_AUTOMATIZACION = ['NUEVO_ELECTOR', 'CAMBIO_COMPROMISO', 'RECORDATORIO_VOTO', 'DIA_ELECCION'] as const
export type CanalAutomatizacion = (typeof CANALES_AUTOMATIZACION)[number]

/** Variables que se pueden usar en una plantilla de automatización. */
export const VARIABLES_AUTOMATIZACION = ['nombre', 'lider', 'candidato', 'puesto', 'mesa', 'fecha_eleccion'] as const

export function renderPlantilla(texto: string, datos: Record<string, string>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (_, k: string) => datos[k] ?? '')
}

const DIA = 86_400_000
const OFFSET_CO = 5 * 3_600_000 // Colombia es UTC-5 todo el año

/** "2026-11-05" en Colombia. */
export function diaColombia(d: Date): string {
  return new Date(d.getTime() - OFFSET_CO).toISOString().slice(0, 10)
}

/**
 * El día de la elección. La configuración la guarda como medianoche UTC del
 * día elegido (`new Date('2027-10-31')`): leída en Colombia caería el 30. Si
 * trae hora, se toma su día en Colombia.
 */
export function diaEleccion(fecha: Date): string {
  return fecha.getUTCHours() === 0 && fecha.getUTCMinutes() === 0 ? fecha.toISOString().slice(0, 10) : diaColombia(fecha)
}

function horaColombia(d: Date): number {
  return new Date(d.getTime() - OFFSET_CO).getUTCHours()
}

/** Primera hora en que salen: nadie quiere un "hoy votamos" a las 2 a. m. */
const HORA_DIA_E = 7
const HORA_RECORDATORIO = 9

/** ¿Una regla por fecha tiene que encolarse en esta corrida? */
export function tocaHoy(trigger: string, conditions: unknown, fechaEleccion: Date | null, ahora: Date): boolean {
  if (!fechaEleccion) return false
  const eleccion = diaEleccion(fechaEleccion)
  if (trigger === 'DIA_ELECCION') return diaColombia(ahora) === eleccion && horaColombia(ahora) >= HORA_DIA_E
  if (trigger === 'RECORDATORIO_VOTO') {
    const d = Number((conditions as { diasAntes?: unknown } | null)?.diasAntes ?? 1)
    const diasAntes = Number.isInteger(d) && d >= 1 && d <= 60 ? d : 1
    const objetivo = new Date(Date.parse(`${eleccion}T00:00:00Z`) - diasAntes * DIA).toISOString().slice(0, 10)
    return diaColombia(ahora) === objetivo && horaColombia(ahora) >= HORA_RECORDATORIO
  }
  return false
}

/** CAMBIO_COMPROMISO con { estado } solo dispara cuando llega a ESE estado. */
export function aplicaCambio(conditions: unknown, estadoNuevo: string): boolean {
  const estado = (conditions as { estado?: unknown } | null)?.estado
  return typeof estado !== 'string' || estado === '' || estado === estadoNuevo
}
