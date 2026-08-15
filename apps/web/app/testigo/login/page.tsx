import { auth } from '@vectra/auth'
import { redirect } from 'next/navigation'
import { getBrandingBySlug } from '@/lib/branding'
import { LoginTestigoForm } from './_components/login-form'

// El template del layout raíz ya añade " | Vectra"
export const metadata = { title: 'Acceso de testigos' }

interface Props {
  searchParams: Promise<{ c?: string }>
}

/**
 * Login exclusivo del testigo: cédula + fecha de nacimiento, sin contraseña ni
 * correo. Separado del de electores (cédula+teléfono) a propósito, para que un
 * testigo nunca quede logueado como elector simple y sin sus accesos el día E.
 * El slug de la campaña viene en ?c= (igual que /electores/login).
 */
export default async function LoginTestigoPage({ searchParams }: Props) {
  const session = await auth()
  const params  = await searchParams

  if (session?.user) {
    redirect('/dia-e/testigo')
  }

  const slug     = params.c ?? ''
  const branding = slug ? await getBrandingBySlug(slug) : null

  return (
    <LoginTestigoForm
      slug={slug}
      tenantName={branding?.tenantName ?? null}
      logoUrl={branding?.logoUrl ?? null}
      primaryColor={branding?.primaryColor ?? null}
    />
  )
}
