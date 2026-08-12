import { redirect } from 'next/navigation'
import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { navDiaE, SCREENS_DIA_E } from './_lib/nav'

export const metadata = { title: 'Día E' }

/**
 * Día E no tenía página raíz: el switcher de módulos del sidebar apunta a
 * /dia-e (app-shell.tsx) y daba 404. Era el único módulo sin page.tsx.
 *
 * No muestra nada propio — manda a la primera pantalla del menú del rol, que
 * es la sala de situación para el equipo de campaña y "Mi mesa" para un
 * testigo.
 */
export default async function DiaEPage() {
  const session = await requireAuthOrRedirect(
    ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO'],
    '/login',
    SCREENS_DIA_E,
  )

  if (!session.user.activeModules.includes('DIA_E')) redirect('/no-autorizado')

  const nav = navDiaE(session.user.role, session.user.customPermissions)
  // Un PERSONALIZADO puede tener el módulo activo y ninguna pantalla concedida.
  redirect(nav[0]?.href ?? '/no-autorizado')
}
