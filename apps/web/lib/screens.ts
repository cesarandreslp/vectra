/**
 * Registro de pantallas asignables a un CustomRole — usado tanto por la UI de
 * armado de roles (matriz de checkboxes en Configuración) como por cada
 * `requireModuleOrScreen()` en el código. Todos los módulos están a
 * granularidad de sub-pantalla (mismo nivel que el menú lateral de cada uno).
 */

export interface ScreenDef {
  label:  string
  modulo: string // moduleKey tal cual vive en activeModules — para agrupar en la UI
  path:   string // a dónde mandar a un rol personalizado cuyo primer permiso sea este
}

export const SCREENS: Record<string, ScreenDef> = {
  CORE_DASHBOARD:     { label: 'Dashboard',        modulo: 'CORE', path: '/core' },
  CORE_ESTRUCTURA:    { label: 'Estructura',        modulo: 'CORE', path: '/core/estructura' },
  CORE_LIDERES:       { label: 'Líderes',           modulo: 'CORE', path: '/core/lideres' },
  CORE_ELECTORES:     { label: 'Electores',         modulo: 'CORE', path: '/core/electores' },
  CORE_IMPORTAR:      { label: 'Importar',          modulo: 'CORE', path: '/core/importar' },
  CORE_QR:            { label: 'QR de captación',   modulo: 'CORE', path: '/core/qr' },
  CORE_TERRITORIO:    { label: 'Territorio',        modulo: 'CORE', path: '/core/territorio' },
  CORE_AGENDA:        { label: 'Agenda',            modulo: 'CORE', path: '/core/agenda' },
  CORE_LOGISTICA:     { label: 'Logística',         modulo: 'CORE', path: '/core/logistica' },
  CORE_ACTIVIDADES:   { label: 'Actividades',       modulo: 'CORE', path: '/core/actividades' },
  CORE_PRESUPUESTOS:  { label: 'Presupuestos',      modulo: 'CORE', path: '/core/presupuestos' },
  CORE_TESORERIA:     { label: 'Tesorería',         modulo: 'CORE', path: '/core/tesoreria' },
  CORE_PERFILES:      { label: 'Perfiles',          modulo: 'CORE', path: '/core/perfiles' },
  CORE_RUTAS:         { label: 'Rutas',             modulo: 'CORE', path: '/core/rutas' },
  CORE_ALERTAS:       { label: 'Alertas',           modulo: 'CORE', path: '/core/alertas' },
  CORE_USUARIOS:      { label: 'Usuarios y testigos', modulo: 'CORE', path: '/core/usuarios' },
  CORE_CONFIGURACION: { label: 'Configuración',     modulo: 'CORE', path: '/core/configuracion' },

  ANALYTICS_DASHBOARD:     { label: 'Dashboard',     modulo: 'ANALYTICS', path: '/analytics' },
  ANALYTICS_TERRITORIO:    { label: 'Territorio',    modulo: 'ANALYTICS', path: '/analytics/territorio' },
  ANALYTICS_LIDERES:       { label: 'Líderes',       modulo: 'ANALYTICS', path: '/analytics/lideres' },
  ANALYTICS_PROYECCION:    { label: 'Proyección',    modulo: 'ANALYTICS', path: '/analytics/proyeccion' },
  ANALYTICS_CONFIGURACION: { label: 'Configuración', modulo: 'ANALYTICS', path: '/analytics/configuracion' },

  FORMACION_MATERIALES:   { label: 'Materiales',      modulo: 'FORMACION', path: '/formacion' },
  FORMACION_SESIONES:     { label: 'Sesiones',        modulo: 'FORMACION', path: '/formacion/sesiones' },
  FORMACION_EVALUACIONES: { label: 'Evaluaciones',    modulo: 'FORMACION', path: '/formacion/evaluaciones' },
  FORMACION_CERTIFICADOS: { label: 'Mis certificados', modulo: 'FORMACION', path: '/formacion/certificados' },
  FORMACION_REPORTES:     { label: 'Reportes',        modulo: 'FORMACION', path: '/formacion/reportes' },

  DIA_E_TESTIGO:        { label: 'Mi mesa (testigo)',   modulo: 'DIA_E', path: '/dia-e/testigo' },
  DIA_E_SALA:           { label: 'Sala de situación',   modulo: 'DIA_E', path: '/dia-e/sala' },
  DIA_E_RESULTADOS:     { label: 'Resultados',          modulo: 'DIA_E', path: '/dia-e/sala/resultados' },
  DIA_E_INCIDENTES:     { label: 'Incidentes',          modulo: 'DIA_E', path: '/dia-e/sala/incidentes' },
  DIA_E_CONFIGURACION:  { label: 'Configuración',       modulo: 'DIA_E', path: '/dia-e/sala/configuracion' },

  COMUNICACIONES_DASHBOARD:       { label: 'Dashboard',        modulo: 'COMUNICACIONES', path: '/comunicaciones' },
  COMUNICACIONES_CAMPANAS:        { label: 'Campañas',         modulo: 'COMUNICACIONES', path: '/comunicaciones/campanas' },
  COMUNICACIONES_PLANTILLAS:      { label: 'Plantillas',       modulo: 'COMUNICACIONES', path: '/comunicaciones/plantillas' },
  COMUNICACIONES_AUTOMATIZACIONES: { label: 'Automatizaciones', modulo: 'COMUNICACIONES', path: '/comunicaciones/automatizaciones' },
  COMUNICACIONES_CONFIGURACION:   { label: 'Config SMTP',      modulo: 'COMUNICACIONES', path: '/comunicaciones/configuracion' },

  FINANZAS_DASHBOARD:     { label: 'Dashboard',     modulo: 'FINANZAS', path: '/finanzas' },
  FINANZAS_GASTOS:        { label: 'Gastos',        modulo: 'FINANZAS', path: '/finanzas/gastos' },
  FINANZAS_DONACIONES:    { label: 'Donaciones',    modulo: 'FINANZAS', path: '/finanzas/donaciones' },
  FINANZAS_INFORMES:      { label: 'Informes',      modulo: 'FINANZAS', path: '/finanzas/informes' },
  FINANZAS_CONFIGURACION: { label: 'Configuración', modulo: 'FINANZAS', path: '/finanzas/configuracion' },

  ENCUESTAS_DASHBOARD:     { label: 'Dashboard',       modulo: 'ENCUESTAS', path: '/encuestas' },
  ENCUESTAS_CAMPANAS:      { label: 'Campañas',        modulo: 'ENCUESTAS', path: '/encuestas/campanas' },
  ENCUESTAS_RESULTADOS:    { label: 'Resultados',      modulo: 'ENCUESTAS', path: '/encuestas/resultados' },
  ENCUESTAS_CONFIGURACION: { label: 'Configuración API', modulo: 'ENCUESTAS', path: '/encuestas/configuracion' },
}

export type ScreenKey = keyof typeof SCREENS

/** Screens agrupados por módulo, en el orden de declaración — para pintar la matriz. */
export function screensPorModulo(): Record<string, { key: string; label: string }[]> {
  const agrupado: Record<string, { key: string; label: string }[]> = {}
  for (const [key, def] of Object.entries(SCREENS)) {
    const lista = agrupado[def.modulo] ?? []
    lista.push({ key, label: def.label })
    agrupado[def.modulo] = lista
  }
  return agrupado
}

/**
 * A dónde mandar a un usuario recién logueado. Los roles fijos siempre
 * tienen algo que ver en /core; un rol PERSONALIZADO puede no tenerlo —
 * lo mandamos a la primera pantalla con canView en su CustomRole.
 */
export function destinoPostLogin(role: string, customPermissions: Record<string, { canView: boolean; canEdit: boolean }>): string {
  if (role === 'SUPERADMIN') return '/superadmin'
  // El testigo entra a su mesa, no al panel: es su única superficie de trabajo.
  if (role === 'TESTIGO')    return '/dia-e/testigo'
  if (role !== 'PERSONALIZADO') return '/core'

  const primeraPermitida = Object.entries(SCREENS).find(([key]) => customPermissions[key]?.canView)
  return primeraPermitida ? primeraPermitida[1].path : '/no-autorizado'
}
