/**
 * Política de tratamiento y derechos del titular (Ley 1581 de 2012, Decreto
 * 1377 de 2013): lo que no toca la base, para probarlo solo.
 */

export const TIPOS_SOLICITUD = {
  CONSULTA:   'Consultar qué datos míos tiene la campaña',
  CORRECCION: 'Corregir o actualizar mis datos',
  SUPRESION:  'Que borren mis datos',
  REVOCACION: 'Retirar la autorización que di',
} as const
export type TipoSolicitud = keyof typeof TIPOS_SOLICITUD

/** Art. 14: consultas en 10 días hábiles. Art. 15: reclamos (corregir, suprimir, revocar) en 15. */
export function diasDePlazo(tipo: TipoSolicitud): number {
  return tipo === 'CONSULTA' ? 10 : 15
}

/**
 * Suma días hábiles saltando sábados y domingos.
 * ponytail: no descuenta festivos de Colombia; el plazo queda unos días ANTES
 * del legal, que es el lado seguro. Si se quiere exacto, agregar el calendario.
 */
export function sumarDiasHabiles(desde: Date, dias: number): Date {
  const d = new Date(desde)
  let faltan = dias
  while (faltan > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) faltan--
  }
  return d
}

/** Política sugerida mientras la campaña no escriba la suya. Que la revise su asesor legal. */
export function politicaSugerida(campana: string, contacto: string | null): string {
  const canal = contacto?.trim() ? contacto.trim() : 'el formulario de esta página'
  return [
    `RESPONSABLE DEL TRATAMIENTO. ${campana}.`,
    `DATOS QUE SE RECOGEN. Nombre, cédula, celular, dirección, fecha de nacimiento y lugar de votación, y lo que la persona decida contar en las conversaciones con la campaña.`,
    `FINALIDADES. Informar sobre la campaña y sus propuestas; invitar a actividades, reuniones y a votar; organizar el trabajo de líderes, voluntarios y testigos electorales; medir el avance de la campaña.`,
    `DATOS SENSIBLES. La opinión o afinidad política es un dato sensible. Nadie está obligado a suministrarla, y solo se trata con autorización expresa.`,
    `DERECHOS DEL TITULAR. Conocer, actualizar y rectificar sus datos; pedir prueba de la autorización; ser informado del uso que se les da; revocar la autorización y pedir la supresión de sus datos; presentar quejas ante la Superintendencia de Industria y Comercio.`,
    `CÓMO EJERCERLOS. Por ${canal}. Las consultas se responden en máximo 10 días hábiles y los reclamos (corrección, supresión, revocación) en máximo 15 días hábiles.`,
    `ENCARGADO Y TRANSFERENCIA. La plataforma tecnológica Vectra trata los datos por cuenta de la campaña, con información cifrada y separada de la de otras campañas. Se almacenan en servidores en Estados Unidos, país que la Superintendencia de Industria y Comercio reconoce con un nivel adecuado de protección de datos.`,
    `VIGENCIA. Los datos se tratan mientras dure la campaña y el tiempo que exija la ley; después se suprimen.`,
  ].join('\n\n')
}
