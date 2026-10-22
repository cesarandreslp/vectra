import { auth } from '@vectra/auth'
import { redirect } from 'next/navigation'
import { getBrandingBySlug } from '@/lib/branding'
import { LoginElectorForm } from './_components/login-form'

interface Props {
  searchParams: Promise<{ c?: string }>
}

/** Instalada desde acá, la app abre en esta puerta y no en el panel del rol que tenga la sesión. */
export async function generateMetadata({ searchParams }: Props) {
  const { c } = await searchParams
  // El template del layout raíz ya añade " | Vectra" al title.
  return { title: 'Iniciar sesión', manifest: `/manifest/elector${c ? `?c=${encodeURIComponent(c)}` : ''}` }
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

  // Solo un elector ya logueado se salta el formulario. Con otra sesión abierta
  // (admin, superadmin) /pwa lo rebotaba a /login de correo y contraseña, y
  // parecía que esta puerta pedía eso. Entrar aquí reemplaza esa sesión.
  if (session?.user?.role === 'ELECTOR') {
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
