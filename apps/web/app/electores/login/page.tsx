import { auth } from '@vectra/auth'
import { redirect } from 'next/navigation'
import { getBrandingBySlug } from '@/lib/branding'
import { LoginElectorForm } from './_components/login-form'

// El template del layout raíz ya añade " | Vectra"
export const metadata = { title: 'Iniciar sesión' }

interface Props {
  searchParams: Promise<{ c?: string }>
}

/**
 * Login para electores (no staff): cédula + teléfono, sin contraseña.
 * El slug de la campaña viene en ?c= (mismo patrón que /registro/[token])
 * porque acá no hay subdominio configurado que lo resuelva. Se usa también
 * para mostrar el logo/color/nombre de LA CAMPAÑA en vez del branding
 * genérico de Vectra — todavía no hay sesión en este punto.
 */
export default async function LoginElectorPage({ searchParams }: Props) {
  const session = await auth()
  const params  = await searchParams

  if (session?.user) {
    redirect('/pwa')
  }

  const slug     = params.c ?? ''
  const branding = slug ? await getBrandingBySlug(slug) : null

  return (
    <LoginElectorForm
      slug={slug}
      tenantName={branding?.tenantName ?? null}
      logoUrl={branding?.logoUrl ?? null}
      primaryColor={branding?.primaryColor ?? null}
    />
  )
}
