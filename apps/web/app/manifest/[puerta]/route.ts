import base from '@/public/manifest.json'

/**
 * Manifest de la PWA por puerta de entrada. El de /manifest.json abre en "/",
 * y "/" manda según la sesión abierta: un admin que instalaba la app desde el
 * login de electores terminaba siempre en /core. Con esto, la app instalada
 * desde una puerta abre en ESA puerta (que deja pasar si la sesión ya es de ese
 * rol, o pide entrar con el formulario si no). Un `id` distinto por puerta y
 * campaña hace que el celular las trate como apps separadas.
 */
const PUERTAS: Record<string, { path: string; nombre: string }> = {
  elector: { path: '/electores/login', nombre: 'Electores' },
  testigo: { path: '/testigo/login',   nombre: 'Testigos' },
}

export async function GET(request: Request, { params }: { params: Promise<{ puerta: string }> }) {
  const puerta = PUERTAS[(await params).puerta]
  if (!puerta) return new Response('Not found', { status: 404 })

  const c = new URL(request.url).searchParams.get('c') ?? ''
  if (!/^[a-z0-9-]*$/.test(c)) return new Response('Bad request', { status: 400 })

  const startUrl = c ? `${puerta.path}?c=${c}` : puerta.path
  return Response.json(
    { ...base, id: startUrl, start_url: startUrl, name: `${base.name} — ${puerta.nombre}`, short_name: puerta.nombre },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  )
}
