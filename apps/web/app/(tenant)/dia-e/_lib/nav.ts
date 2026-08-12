import type { NavItem } from '@/app/_components/app-shell'
import type { CustomPermissions, UserRole } from '@campaignos/auth'

export const SCREENS_DIA_E = [
  'DIA_E_TESTIGO', 'DIA_E_SALA', 'DIA_E_RESULTADOS',
  'DIA_E_ASIGNACIONES', 'DIA_E_INCIDENTES', 'DIA_E_CONFIGURACION',
]

/**
 * Menú de Día E según el rol. Vive acá y no dentro del layout porque la página
 * raíz (/dia-e) aterriza en la PRIMERA opción de este menú: si cada uno armara
 * su propia lista, el módulo podría mandarte a una pantalla que tu rol no ve.
 *
 * Un testigo solo ve su mesa; el resto entra por la sala de situación.
 */
export function navDiaE(role: UserRole, customPermissions: CustomPermissions): NavItem[] {
  if (role === 'PERSONALIZADO') {
    const puedeVer = (k: string) => Boolean(customPermissions[k]?.canView)
    return [
      ...(puedeVer('DIA_E_TESTIGO')       ? [{ href: '/dia-e/testigo',             label: 'Mi mesa' }] : []),
      ...(puedeVer('DIA_E_SALA')          ? [{ href: '/dia-e/sala',                label: 'Sala de situación' }] : []),
      ...(puedeVer('DIA_E_RESULTADOS')    ? [{ href: '/dia-e/sala/resultados',     label: 'Resultados' }] : []),
      ...(puedeVer('DIA_E_ASIGNACIONES')  ? [{ href: '/dia-e/sala/asignaciones',   label: 'Asignaciones' }] : []),
      ...(puedeVer('DIA_E_INCIDENTES')    ? [{ href: '/dia-e/sala/incidentes',     label: 'Incidentes' }] : []),
      ...(puedeVer('DIA_E_CONFIGURACION') ? [{ href: '/dia-e/sala/configuracion',  label: 'Configuración' }] : []),
    ]
  }

  if (role === 'TESTIGO') return [{ href: '/dia-e/testigo', label: 'Mi mesa' }]

  return [
    { href: '/dia-e/sala',               label: 'Sala de situación' },
    { href: '/dia-e/sala/resultados',    label: 'Resultados' },
    { href: '/dia-e/sala/asignaciones',  label: 'Asignaciones' },
    { href: '/dia-e/sala/incidentes',    label: 'Incidentes' },
    { href: '/dia-e/sala/configuracion', label: 'Configuración' },
  ]
}
