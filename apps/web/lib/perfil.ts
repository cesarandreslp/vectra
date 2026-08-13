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
// POSGRADO ya no es un nivel: pasó a ser su propia pregunta (ver POSGRADOS).
export const NIVELES = ['PRIMARIA', 'BACHILLER', 'TECNICO', 'TECNOLOGO', 'UNIVERSITARIO'] as const
export const POSGRADOS = ['ESPECIALISTA', 'MAGISTER', 'DOCTOR'] as const

export type Vehiculo = typeof VEHICULOS[number]
export type Nivel = typeof NIVELES[number]
export type Posgrado = typeof POSGRADOS[number]

export const ETIQUETA_NIVEL: Record<Nivel, string> = {
  PRIMARIA: 'primaria', BACHILLER: 'bachiller', TECNICO: 'técnico',
  TECNOLOGO: 'tecnólogo', UNIVERSITARIO: 'profesional',
}
export const ETIQUETA_POSGRADO: Record<Posgrado, string> = {
  ESPECIALISTA: 'especialista', MAGISTER: 'magíster', DOCTOR: 'doctor',
}

/** Niveles que llevan un "¿en qué?": nadie es bachiller *en* algo. */
export const NIVELES_CON_TITULO: readonly Nivel[] = ['TECNICO', 'TECNOLOGO', 'UNIVERSITARIO']

/**
 * Punto de partida de las listas desplegables, para que una campaña nueva no
 * arranque con el desplegable vacío. Se mezclan con lo que ya escribió la gente
 * de esta campaña (ver getVocabulario): lo que alguien digita queda de opción
 * para el que sigue, así la lista se enriquece sola.
 */
export const SUGERENCIAS = {
  oficios: [
    'agricultor', 'albañil', 'ama de casa', 'comerciante', 'conductor', 'docente',
    'electricista', 'enfermero', 'estudiante', 'independiente', 'mecánico', 'modista',
    'obrero', 'panadero', 'peluquero', 'pensionado', 'tendero', 'vendedor', 'vigilante',
  ],
  habilidades: [
    'atención al público', 'conducir', 'cocinar', 'contabilidad', 'cuidado de niños',
    'digitar datos', 'electricidad', 'fotografía', 'hablar en público', 'logística',
    'organizar grupos', 'primeros auxilios', 'redes sociales', 'sonido', 'tocar música',
  ],
  herramientas: [
    'cámara', 'camioneta', 'carpa', 'computador', 'impresora', 'megáfono', 'mesas',
    'moto', 'olla comunitaria', 'planta eléctrica', 'sillas', 'sonido', 'termos',
  ],
  certificaciones: [
    'atención al cliente', 'conducción c1', 'manipulación de alimentos', 'primeros auxilios',
    'sg-sst', 'sistemas y ofimática', 'soldadura', 'trabajo en alturas', 'vigilancia',
  ],
  titulos: [
    'administración', 'agropecuaria', 'contaduría', 'derecho', 'educación física',
    'enfermería', 'ingeniería civil', 'ingeniería de sistemas', 'licenciatura',
    'mercadeo', 'psicología', 'salud ocupacional', 'trabajo social',
  ],
} as const

/** "sonido, cocina , primeros auxilios" → ["sonido","cocina","primeros auxilios"] */
export const aEtiquetas = (texto: string): string[] =>
  [...new Set(texto.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]

/** Normaliza una opción escrita a mano para que no entren dos veces "Sonido" y "sonido". */
export const normalizar = (t: string): string => t.trim().toLowerCase()

/** Semillas + lo que ya existe en la campaña, sin repetidos y en orden alfabético. */
export const mezclarOpciones = (semillas: readonly string[], usadas: string[]): string[] =>
  [...new Set([...semillas, ...usadas.map(normalizar)])].filter(Boolean).sort((a, b) => a.localeCompare(b))
