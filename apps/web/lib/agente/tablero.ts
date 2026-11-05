/**
 * Tablero del agente: embudo y temas por zona. Puro (sin base) para probarlo.
 * Se cuenta por PERSONA (conversación), no por mensaje: quien escribe veinte
 * veces sobre las vías no pesa veinte veces más que su vecino.
 */

import { TEMAS, type Tema } from './salida'

export const ETIQUETA_TEMA: Record<Tema, string> = {
  seguridad: 'Seguridad', empleo: 'Empleo', salud: 'Salud', educacion: 'Educación', vias: 'Vías',
  servicios_publicos: 'Servicios públicos', medio_ambiente: 'Medio ambiente', vivienda: 'Vivienda',
  movilidad: 'Movilidad', deporte_cultura: 'Deporte y cultura', campo: 'Campo', corrupcion: 'Corrupción',
  programa_social: 'Programas sociales', otro: 'Otro',
}

/** Un color por tema, fijo, para que el mapa y las barras digan lo mismo. */
export const COLOR_TEMA: Record<Tema, string> = {
  seguridad: '#dc2626', empleo: '#2563eb', salud: '#16a34a', educacion: '#9333ea', vias: '#ea580c',
  servicios_publicos: '#0891b2', medio_ambiente: '#65a30d', vivienda: '#c026d3', movilidad: '#ca8a04',
  deporte_cultura: '#db2777', campo: '#4d7c0f', corrupcion: '#7f1d1d', programa_social: '#0d9488', otro: '#64748b',
}

export interface ConvTablero {
  autorizo:     boolean
  pendiente:    boolean // escalada sin atender
  escalada:     boolean // alguna vez
  registrada:   boolean // dejó al menos su nombre, o ya era elector
  elector:      boolean // es elector o su contacto se convirtió
  comprometido: boolean // elector COMPROMETIDO o VOTO_SEGURO
  voluntario:   boolean
  comunaId:     string | null
  temas:        string[] // de todos sus mensajes, con repetidos
  creada:       Date
}

export interface ConteoTema { tema: Tema; n: number }
export interface ZonaTemas { comunaId: string | null; personas: number; temas: ConteoTema[] }

export interface ResumenTablero {
  conversaciones: number
  ultimos7:       number
  autorizaron:    number
  pendientes:     number
  escaladas:      number
  voluntarios:    number
  embudo:         { etapa: string; n: number }[]
  temas:          ConteoTema[]
  porComuna:      ZonaTemas[] // con más personas primero; comunaId null = sin zona conocida
}

function contarTemas(convs: ConvTablero[]): ConteoTema[] {
  const n = new Map<Tema, number>()
  for (const c of convs) {
    for (const t of new Set(c.temas)) {
      if (t === 'otro' || !TEMAS.includes(t as Tema)) continue // "otro" no orienta nada
      n.set(t as Tema, (n.get(t as Tema) ?? 0) + 1)
    }
  }
  return [...n].map(([tema, k]) => ({ tema, n: k })).sort((a, b) => b.n - a.n || a.tema.localeCompare(b.tema))
}

export function resumirTablero(convs: ConvTablero[], ahora: Date): ResumenTablero {
  const hace7 = ahora.getTime() - 7 * 86_400_000
  const zonas = new Map<string | null, ConvTablero[]>()
  for (const c of convs) zonas.set(c.comunaId, [...(zonas.get(c.comunaId) ?? []), c])

  const cuenta = (f: (c: ConvTablero) => boolean) => convs.filter(f).length
  return {
    conversaciones: convs.length,
    ultimos7:       cuenta((c) => c.creada.getTime() >= hace7),
    autorizaron:    cuenta((c) => c.autorizo),
    pendientes:     cuenta((c) => c.pendiente),
    escaladas:      cuenta((c) => c.escalada),
    voluntarios:    cuenta((c) => c.voluntario),
    embudo: [
      { etapa: 'Conversaron',          n: convs.length },
      { etapa: 'Autorizaron sus datos', n: cuenta((c) => c.autorizo) },
      { etapa: 'Quedaron registrados', n: cuenta((c) => c.registrada) },
      { etapa: 'Son electores',        n: cuenta((c) => c.elector) },
      { etapa: 'Comprometidos',        n: cuenta((c) => c.comprometido) },
    ],
    temas: contarTemas(convs),
    porComuna: [...zonas]
      .map(([comunaId, cs]) => ({ comunaId, personas: cs.length, temas: contarTemas(cs) }))
      .sort((a, b) => Number(a.comunaId === null) - Number(b.comunaId === null) || b.personas - a.personas),
  }
}
