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

export const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
const COLUMNAS: Record<string, string> = {
  NUIP: 'nuip', DEPARTAMENTO: 'departamento', MUNICIPIO: 'municipio',
  PUESTO: 'puesto', DIRECCION: 'direccion', MESA: 'mesa',
}

/**
 * Lee lo que la persona copió (Ctrl+A, Ctrl+C) de la página oficial tras
 * consultar. La tabla llega con las celdas separadas por tabulador, o una por
 * línea según el navegador. null = no se reconoce un resultado.
 * nuip viene aparte para comprobar que el resultado es de esa cédula; no se guarda.
 */
export function leerResultadoPegado(texto: string): { nuip: string; resultado: ResultadoRegistraduria } | null {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const i = lineas.findIndex((l) => sinTildes(l).startsWith('NUIP'))

  if (i >= 0) {
    let cabeceras = lineas[i].split('\t').map(sinTildes)
    let valores   = (lineas[i + 1] ?? '').split('\t').map((v) => v.trim())
    if (cabeceras.length === 1) { // una celda por línea
      cabeceras = lineas.slice(i, i + 6).map(sinTildes)
      valores   = lineas.slice(i + 6, i + 12)
    }
    const fila: Record<string, string> = {}
    cabeceras.forEach((c, k) => { if (COLUMNAS[c] && valores[k]) fila[COLUMNAS[c]] = valores[k] })
    if (fila.puesto && fila.mesa) {
      const { nuip = '', ...lugar } = fila
      return { nuip: nuip.replace(/\D/g, ''), resultado: { estado: 'ENCONTRADO', lugar: { estado: 'encontrado', ...lugar } } }
    }
  }

  // Sin tabla: la página muestra "NOVEDAD:" seguido del mensaje (no inscrito o con novedad).
  const n = lineas.findIndex((l) => sinTildes(l).startsWith('NOVEDAD'))
  if (n < 0) return null
  const mensaje = [lineas[n].replace(/^NOVEDAD:?\s*/i, ''), lineas[n + 1] ?? '']
    .filter(Boolean).join(' — ').slice(0, 300)
  const noEsta = /NO SE ENCUENTRA|NO FIGURA|NO APARECE|NO ESTA/.test(sinTildes(mensaje))
  return {
    nuip: '',
    resultado: noEsta
      ? { estado: 'NO_ENCONTRADO', lugar: { estado: 'no_encontrado', mensaje } }
      : { estado: 'NOVEDAD',       lugar: { estado: 'novedad', mensaje } },
  }
}

/** El municipio con más puestos de la campaña: valor inicial del formulario. */
export function puestoMasComun(puestos: PuestoConocido[]): PuestoConocido | null {
  const veces = new Map<string, number>()
  for (const p of puestos) veces.set(p.municipio, (veces.get(p.municipio) ?? 0) + 1)
  return puestos.reduce<PuestoConocido | null>((m, p) => (!m || veces.get(p.municipio)! > veces.get(m.municipio)! ? p : m), null)
}
