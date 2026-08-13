import { getTenantConnection } from '@/lib/tenant'
import { superadminDb, getTenantDb } from '@vectra/db'
import { FormularioRegistro } from './_components/formulario-registro'
import { IconLinkOff } from '@/app/_components/icons'

interface Props {
  params:      Promise<{ token: string }>
  searchParams: Promise<{ ref?: string; c?: string }>
}

/**
 * Página pública de registro por QR.
 * No requiere autenticación — el elector llega desde su celular.
 * Server Component: verifica el token y carga los puestos de votación.
 */
export default async function RegistroQRPage({ params, searchParams }: Props) {
  const { token }     = await params
  const { ref, c: slug } = await searchParams

  // El tenant se resuelve por su slug (viene en ?c= de la URL del QR), no por
  // host: las rutas públicas no pasan por la resolución de tenant del middleware.
  if (!slug) {
    return <PaginaError mensaje="Este enlace no corresponde a ninguna campaña." />
  }

  const tenant = await superadminDb.tenant.findUnique({
    where:  { slug },
    select: { id: true, name: true, isActive: true },
  })

  if (!tenant || !tenant.isActive) {
    return <PaginaError mensaje="Este enlace no corresponde a ninguna campaña." />
  }

  const tenantId   = tenant.id
  const tenantName = tenant.name

  let db: ReturnType<typeof getTenantDb>
  try {
    const connectionString = await getTenantConnection(tenantId)
    db = getTenantDb(connectionString)
  } catch {
    return <PaginaError mensaje="Este enlace ya no está disponible." />
  }

  const qr = await db.qrRegistration.findFirst({
    where:  { token, tenantId, isActive: true },
    select: { id: true, expiresAt: true },
  })

  if (!qr) {
    return <PaginaError mensaje="Este enlace ya no está disponible." />
  }

  if (qr.expiresAt && qr.expiresAt < new Date()) {
    return <PaginaError mensaje="Este enlace ha expirado." />
  }

  // Cargar puestos de votación para el select
  const puestos = await db.votingStation.findMany({
    select: {
      id:     true,
      name:   true,
      tables: { select: { id: true, number: true } },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div
      style={{
        minHeight:      '100vh',
        background:     '#f1f5f9',
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'center',
        padding:        '1.5rem 1rem',
        fontFamily:     'system-ui, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Encabezado */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{tenantName}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Formulario de registro</div>
        </div>

        {/* Formulario client component */}
        <FormularioRegistro slug={slug} token={token} refId={ref} puestos={puestos} />
      </div>
    </div>
  )
}

function PaginaError({ mensaje }: { mensaje: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: '360px', padding: '2rem' }}>
        <div style={{ color: '#94a3b8', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
          <IconLinkOff size={40} />
        </div>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Enlace no disponible</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{mensaje}</p>
      </div>
    </div>
  )
}
