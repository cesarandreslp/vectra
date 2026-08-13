import { auth } from '@vectra/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getBrandingBySlug, getBrandingFromHost } from '@/lib/branding'
import { destinoPostLogin } from '@/lib/screens'
import { LoginForm } from './_components/login-form'

// El template del layout raíz ya añade " | Vectra"
export const metadata = { title: 'Iniciar sesión' }

/**
 * Página de login universal de Vectra (staff: SUPERADMIN/ADMIN_CAMPANA/
 * COORDINADOR/LIDER/TESTIGO). Server Component: si ya hay sesión, redirige
 * al destino correcto sin mostrar el formulario.
 *
 * El branding de Vectra (logo/granate) es el de por defecto — le corresponde
 * solo al SUPERADMIN operando el SaaS. Una campaña puede compartir su propio
 * link de login con su equipo (?c=slug, mismo patrón que /electores/login)
 * para que vean SU logo/color en vez del genérico — cosmético únicamente,
 * la autenticación sigue siendo universal por email (no depende del slug).
 *
 * Resolución del destino post-login:
 *   - SUPERADMIN  → /superadmin
 *   - cualquier otro rol → /
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; c?: string }>
}) {
  const session = await auth()
  const params  = await searchParams

  if (session?.user) {
    const destino = params.callbackUrl ?? destinoPostLogin(session.user.role, session.user.customPermissions)
    redirect(destino)
  }

  // ?c=slug manda si viene (link compartido explícito); si no, se intenta
  // derivar del host — así el equipo de una campaña entrando por su propio
  // subdominio nunca ve el branding genérico de Vectra por accidente.
  const branding = params.c
    ? await getBrandingBySlug(params.c)
    : await getBrandingFromHost((await headers()).get('host'))

  return (
    <LoginForm
      callbackUrl={params.callbackUrl}
      tenantName={branding?.tenantName ?? null}
      logoUrl={branding?.logoUrl ?? null}
      primaryColor={branding?.primaryColor ?? null}
    />
  )
}
