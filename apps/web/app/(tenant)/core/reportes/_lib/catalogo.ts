/**
 * Reportes del CORE. Cada uno es una tabla que se puede ver, descargar en Excel
 * e imprimir (ver TablaReporte); el E-26 tiene su propia página con formato de acta.
 */
export interface ReporteDef {
  id:          string
  titulo:      string
  descripcion: string
  grupo:       'Organización' | 'Territorio y metas' | 'Calidad de datos' | 'Día E y escrutinio'
  /** Solo se ofrece si la campaña tiene este módulo activo. */
  modulo?:     string
  /** Página propia en vez de la tabla genérica. */
  href?:       string
}

export const REPORTES: ReporteDef[] = [
  { id: 'lideres',    grupo: 'Organización',       titulo: 'Red por líder',
    descripcion: 'Cada persona con gente a cargo: directos, red completa, comprometidos y títulos.' },
  { id: 'compromiso', grupo: 'Organización',       titulo: 'Estado de compromiso',
    descripcion: 'Cuántos electores hay en cada estado, de sin contactar a voto seguro.' },
  { id: 'metas',      grupo: 'Territorio y metas', titulo: 'Avance de metas por comuna',
    descripcion: 'Meta de votos de cada comuna y corregimiento contra comprometidos + voto seguro.' },
  { id: 'puestos',    grupo: 'Territorio y metas', titulo: 'Electores por puesto de votación',
    descripcion: 'Dónde vota nuestra gente: electores y comprometidos por puesto, y mesas con testigo.' },
  { id: 'mesas',      grupo: 'Territorio y metas', titulo: 'Listado por puesto y mesa',
    descripcion: 'Quién vota en cada mesa, con su líder y estado: base para movilizar el día E.' },
  { id: 'calidad',    grupo: 'Calidad de datos',   titulo: 'Datos incompletos',
    descripcion: 'Electores sin teléfono, sin dirección, sin ubicar en el mapa, sin mesa o con novedad en el censo.' },
  { id: 'testigos',   grupo: 'Día E y escrutinio', titulo: 'Cobertura de testigos', modulo: 'DIA_E',
    descripcion: 'Mesas con y sin testigo en cada puesto.' },
  { id: 'preconteo',  grupo: 'Día E y escrutinio', titulo: 'Resultados de preconteo (E-14)', modulo: 'DIA_E',
    descripcion: 'Votos por candidato según los E-14 transmitidos por los testigos.' },
  { id: 'e24',        grupo: 'Día E y escrutinio', titulo: 'Borrador de escrutinio (E-24)', modulo: 'DIA_E',
    descripcion: 'Mesa por mesa, lo que dejó la comisión escrutadora frente al E-14, con las correcciones marcadas.' },
  { id: 'e26',        grupo: 'Día E y escrutinio', titulo: 'Consolidado de escrutinio (formato E-26)', modulo: 'DIA_E',
    href: '/core/reportes/e26',
    descripcion: 'Consolidado del escrutinio (E-24) por zona o municipio frente al preconteo, en números y letras, con cifra repartidora: para cotejar el E-26 oficial.' },
]
