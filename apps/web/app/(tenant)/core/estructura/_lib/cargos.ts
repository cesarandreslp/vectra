/**
 * Plantilla de cargos requeridos según el tipo de campaña (TenantConfig.electionOffice).
 * Son datos, no modelo: quién ocupa cada plaza vive en CargoAsignacion.
 */

export type EstadoCargo = 'VACANTE' | 'CONVERSACION' | 'ASIGNADO'

export interface CargoPlantilla {
  clave:       string
  nombre:      string
  descripcion: string
  multiple?:   true // una plaza por cada líder que pide la meta en cascada
}

const CONCEJAL: CargoPlantilla[] = [
  { clave: 'GERENTE',           nombre: 'Gerente de campaña',             descripcion: 'Dirige la operación diaria y responde por el plan ante el candidato.' },
  { clave: 'COORD_TERRITORIAL', nombre: 'Coordinador territorial',        descripcion: 'La red en la calle: comunas, barrios y líderes de zona.' },
  { clave: 'COORD_TESTIGOS',    nombre: 'Coordinador de testigos y día D', descripcion: 'Un testigo por mesa, su formación y la sala de situación del día de elecciones.' },
  { clave: 'COORD_DIGITAL',     nombre: 'Coordinador digital',            descripcion: 'Redes, mensajes y contenidos de la campaña.' },
  { clave: 'TESORERO',          nombre: 'Tesorero',                       descripcion: 'La plata: topes, rendición de cuentas (Cuentas Claras) e informes al CNE.' },
  { clave: 'JURIDICO',          nombre: 'Asesor jurídico',                descripcion: 'La ley: habilitación del candidato, protección de datos y reclamaciones del día E.' },
  { clave: 'LIDER_ZONA',        nombre: 'Líder de zona',                  descripcion: 'Tantos como pide la meta de votos en cascada.', multiple: true },
]

// ponytail: solo CONCEJAL tiene plantilla propia; los demás cargos usan la misma
// hasta que llegue una campaña de ese tipo con su propio organigrama.
const PLANTILLAS: Partial<Record<string, CargoPlantilla[]>> = { CONCEJAL }

export function plantillaPara(electionOffice: string | null | undefined): CargoPlantilla[] {
  return (electionOffice && PLANTILLAS[electionOffice]) || CONCEJAL
}

/** Plazas que pide un cargo: 1, o los líderes de la cascada si es múltiple. */
export function plazas(cargo: CargoPlantilla, lideres: number): number {
  return cargo.multiple ? lideres : 1
}

/** null si el estado y la persona cuadran; si no, el error para el usuario. */
export function validarCargo(estado: string, voterId: string | null, userId: string | null): string | null {
  if (!['VACANTE', 'CONVERSACION', 'ASIGNADO'].includes(estado)) return 'Estado inválido.'
  if (voterId && userId) return 'Un cargo lo ocupa una sola persona.'
  if (estado === 'VACANTE' && (voterId || userId)) return 'Un cargo vacante no tiene persona.'
  if (estado === 'ASIGNADO' && !voterId && !userId) return 'Elige a quién se asigna el cargo.'
  return null
}

// El jurídico de antes de la plantilla se armaba como rol personalizado:
// sin asignación guardada, se toma al staff cuyo rol suene a jurídico.
export const JURIDICO_RE = /jur[íi]dic|abogad|asesor.*legal|\blegal\b/i
