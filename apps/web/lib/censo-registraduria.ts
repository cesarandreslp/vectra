/**
 * Consulta oficial de la Registraduría (consultacenso.registraduria.gov.co),
 * hecha desde el NAVEGADOR de quien registra al elector: la API acepta llamadas
 * de otros sitios (CORS), igual que si la persona usara la página oficial.
 *
 * Desde el servidor NO: Cloudflare responde 403 a todo lo que no sea un
 * navegador, y eso no se evade. Por lo mismo, una consulta por alta o por clic;
 * nada de lotes.
 *
 * El resultado se traduce a la misma forma que guardaba la API anterior en
 * Voter.censoLugar, así ficha, mapa, Sala y asignarMesasDelCenso no cambian.
 */

const API = 'https://consultacenso.registraduria.gov.co/back/api/consulta'

export type EstadoRegistraduria = 'ENCONTRADO' | 'NOVEDAD' | 'NO_ENCONTRADO'

export interface ResultadoRegistraduria {
  estado: EstadoRegistraduria
  lugar:  Record<string, string | number>
}

type Json = Record<string, unknown>

const texto  = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '')
const numero = (v: unknown) => (v === null || v === '' || v === undefined ? NaN : Number(v))

/** Respuesta de /back/api/consulta → lo que se guarda. null = la consulta falló. */
export function interpretarRegistraduria(json: Json): ResultadoRegistraduria | null {
  if (json.ok !== true) return null

  if (json.encontrado) {
    // Las claves llegan en minúscula o MAYÚSCULA según el procedimiento (así lo lee app.js oficial).
    const d    = (json.data ?? {}) as Json
    const get  = (a: string, b: string) => texto(d[a] ?? d[b])
    const mapa = (json.mapa ?? {}) as Json
    const lat  = numero(mapa.lat)
    const lng  = numero(mapa.lng)
    // nuip (la cédula en claro) no se toma: PII, Ley 1581.
    const lugar: Record<string, string | number> = {
      estado:       'encontrado',
      departamento: get('nom_depto', 'DEPARTAMENTO'),
      municipio:    get('nom_mun', 'MUNICIPIO'),
      puesto:       get('nom_puesto', 'PUESTO'),
      direccion:    get('direccion', 'DIRECCION'),
      mesa:         get('mesa', 'MESA'),
    }
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      lugar.latitud  = lat
      lugar.longitud = lng
      lugar.mapa_url = texto(mapa.url).startsWith('https://')
        ? texto(mapa.url)
        : `https://www.google.com/maps?q=${lat},${lng}`
    }
    return { estado: 'ENCONTRADO', lugar }
  }

  const mensaje = [texto(json.mensaje), texto(json.descripcion)].filter(Boolean).join(' — ')
  return json.novedad
    ? { estado: 'NOVEDAD',       lugar: { estado: 'novedad', mensaje } }
    : { estado: 'NO_ENCONTRADO', lugar: { estado: 'no_encontrado', mensaje } }
}

/** Solo en el navegador. eleccionId 0 = "LUGAR DE VOTACION ACTUAL". */
export async function consultarRegistraduria(cedula: string): Promise<ResultadoRegistraduria | null> {
  const documento = cedula.replace(/\D/g, '')
  if (documento.length < 2 || documento.length > 12) return null
  try {
    const res = await fetch(API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      // captchaToken 'dev' es lo que manda la propia página oficial (tiene el captcha apagado).
      body:    JSON.stringify({ documento, eleccionId: 0, captchaToken: 'dev' }),
      signal:  AbortSignal.timeout(30_000),
    })
    return interpretarRegistraduria((await res.json()) as Json)
  } catch {
    return null
  }
}
