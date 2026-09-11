/**
 * Alcance territorial de cada cargo de elección popular:
 *   ALCALDE, CONCEJAL                        → municipio
 *   GOBERNADOR, DIPUTADO, REPRESENTANTE      → departamento
 *   SENADOR, PRESIDENTE                      → país (circunscripción nacional)
 *
 * Vive fuera de core/actions.ts porque un archivo 'use server' solo puede
 * exportar funciones async, y estas listas las usan también los mapas.
 */

export const CARGOS_NACIONALES      = ['SENADOR', 'PRESIDENTE']
export const CARGOS_DEPARTAMENTALES = ['GOBERNADOR', 'DIPUTADO', 'REPRESENTANTE']
export const CARGOS_MUNICIPALES     = ['ALCALDE', 'CONCEJAL']

/** Contorno de la jurisdicción listo para Leaflet: anillos exteriores en [lat, lng]. */
export interface LimiteMapa {
  nombre:  string
  anillos: [number, number][][]
}
