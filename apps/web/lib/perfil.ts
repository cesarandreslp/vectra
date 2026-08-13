/**
 * Vocabulario compartido de la hoja de vida del simpatizante: lo usan el PWA
 * (para que la persona se describa) y el buscador del equipo (para filtrar).
 * Una sola lista, así lo que se guarda y lo que se busca no se desalinean.
 */

export const DIAS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'] as const
export const FRANJAS = ['MANANA', 'TARDE', 'NOCHE'] as const

export type Dia = typeof DIAS[number]
export type Franja = typeof FRANJAS[number]

/** Token de disponibilidad tal cual se guarda: "SAB_MANANA". */
export const slot = (dia: Dia, franja: Franja) => `${dia}_${franja}`

export const ETIQUETA_DIA: Record<Dia, string> = {
  LUN: 'Lun', MAR: 'Mar', MIE: 'Mié', JUE: 'Jue', VIE: 'Vie', SAB: 'Sáb', DOM: 'Dom',
}
export const ETIQUETA_FRANJA: Record<Franja, string> = {
  MANANA: 'Mañana', TARDE: 'Tarde', NOCHE: 'Noche',
}

export const VEHICULOS = ['NINGUNO', 'BICICLETA', 'MOTO', 'CARRO', 'CAMION'] as const
export const NIVELES = ['PRIMARIA', 'BACHILLER', 'TECNICO', 'UNIVERSITARIO', 'POSGRADO'] as const

export type Vehiculo = typeof VEHICULOS[number]
export type Nivel = typeof NIVELES[number]

/** "sonido, cocina , primeros auxilios" → ["sonido","cocina","primeros auxilios"] */
export const aEtiquetas = (texto: string): string[] =>
  [...new Set(texto.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]
