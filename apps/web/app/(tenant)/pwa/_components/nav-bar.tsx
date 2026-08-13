'use client'

/**
 * Barra de navegación inferior de la PWA — antes cada pantalla (Mis
 * electores, Reuniones, Encuesta) era una isla, solo alcanzable si había
 * un botón de paso hacia ella en otra pantalla. Fija abajo, patrón estándar
 * de apps móviles, para que el elector siempre sepa qué más puede hacer.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconUsers, IconCalendar, IconClipboard, IconClock, IconCheck } from '@/app/_components/icons'

interface NavBarProps {
  mostrarEncuestas: boolean
  /** Solo para el doliente de alguna actividad — el resto no tiene qué gestionar ahí. */
  mostrarActividades: boolean
}

export function NavBar({ mostrarEncuestas, mostrarActividades }: NavBarProps) {
  const pathname = usePathname()

  const tabs = [
    { href: '/pwa', label: 'Mis electores', icon: IconUsers, activo: pathname === '/pwa' },
    { href: '/pwa/reuniones', label: 'Reuniones', icon: IconCalendar, activo: pathname.startsWith('/pwa/reuniones') },
    { href: '/pwa/agenda', label: 'Agenda', icon: IconClock, activo: pathname.startsWith('/pwa/agenda') },
    ...(mostrarActividades
      ? [{ href: '/pwa/actividades', label: 'Actividades', icon: IconClipboard, activo: pathname.startsWith('/pwa/actividades') }]
      : []),
    ...(mostrarEncuestas
      ? [{ href: '/pwa/encuestas', label: 'Encuesta', icon: IconClipboard, activo: pathname.startsWith('/pwa/encuestas') }]
      : []),
    // Para todos: es donde alguien se ofrece para las actividades. Llenarlo es
    // lo que lo convierte en simpatizante, así que no se puede exigir serlo antes.
    { href: '/pwa/perfil', label: 'Mi perfil', icon: IconCheck, activo: pathname.startsWith('/pwa/perfil') },
  ]

  return (
    <nav
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
        background: '#fff', borderTop: '1px solid #e2e8f0',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                padding: '0.5rem 0', textDecoration: 'none',
                color: tab.activo ? '#0f172a' : '#94a3b8',
              }}
            >
              <Icon size={20} />
              <span style={{ fontSize: '0.68rem', fontWeight: tab.activo ? 700 : 500 }}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
