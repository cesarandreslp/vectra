/**
 * Consulta ASISTIDA del lugar de votación: una persona consulta en la página
 * oficial de la Registraduría y registra en Vectra lo que ve.
 *
 * No hay consulta automática posible por la vía oficial: desde un servidor
 * Cloudflare responde 403, y desde el navegador la API rechaza otros orígenes
 * (el preflight CORS de /back/api/consulta no trae Access-Control-Allow-Origin).
 * Saltarse cualquiera de las dos es evadir sus controles, y no se hace.
 *
 * Lo registrado se guarda con la misma forma que la API anterior en
 * Voter.censoLugar, así ficha, mapa, Sala y asignarMesasDelCenso no cambian.
 */

export const CONSULTA_OFICIAL = 'https://consultacenso.registraduria.gov.co/'

export type EstadoRegistraduria = 'ENCONTRADO' | 'NOVEDAD' | 'NO_ENCONTRADO'

export interface ResultadoRegistraduria {
  estado: EstadoRegistraduria
  lugar:  Record<string, string | number>
}

export interface PuestoConocido {
  nombre:       string
  municipio:    string
  departamento: string
}
