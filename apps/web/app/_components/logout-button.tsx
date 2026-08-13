import { signOut } from '@vectra/auth'

/**
 * Botón de cierre de sesión del shell.
 *
 * Es un form con Server Action, no un onClick: funciona sin JavaScript y sin
 * hidratación, igual que el resto del AppShell. `redirectTo` manda al login
 * en vez de a la landing para que no quede la impresión de seguir dentro.
 */
const TONOS = {
  // Pie del sidebar (fondo = color de marca del tenant). Los colores salen de las
  // vars que pone varsDeMarca en el <aside>, no fijos: sobre una marca clara el
  // blanco no se lee. Ver lib/brand-contrast.ts.
  oscuro: 'w-full border-[var(--brand-border)] text-[var(--brand-fg-dim)] hover:border-[var(--brand-fg)] hover:bg-[var(--brand-hover)] hover:text-[var(--brand-fg)]',
  // Barra superior de escritorio (fondo blanco). Sigue accesible aunque el
  // sidebar esté colapsado, que si no dejaría al usuario sin salida visible.
  claro:  'border-slate-300 text-slate-600 hover:border-granate hover:bg-granate/5 hover:text-granate',
} as const

export function LogoutButton({ tono = 'oscuro', redirectTo = '/login' }: { tono?: keyof typeof TONOS; redirectTo?: string }) {
  async function cerrarSesion() {
    'use server'
    await signOut({ redirectTo })
  }

  return (
    <form action={cerrarSesion}>
      <button
        type="submit"
        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold whitespace-nowrap transition ${TONOS[tono]}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M12 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h6" />
        </svg>
        Cerrar sesión
      </button>
    </form>
  )
}
