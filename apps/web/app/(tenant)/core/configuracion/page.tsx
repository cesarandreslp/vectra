import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { getConfiguracion, listarDepartamentos } from './actions'
import Link from 'next/link'
import { listarRoles } from './actions-roles'
import { ConfigForm }     from './_components/config-form'
import { RolesPanel }     from './_components/roles-panel'

export const metadata = { title: 'Configuración' }

/** Configuración de la campaña — solo ADMIN_CAMPANA. */
export default async function ConfiguracionPage() {
  await requireAuthOrRedirect(['ADMIN_CAMPANA'])
  const [cfg, departamentos, roles] = await Promise.all([
    getConfiguracion(), listarDepartamentos(), listarRoles(),
  ])

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>
        Configuración de la campaña
      </h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Claves de IA propias, dominio y branding de tu campaña.
      </p>
      <ConfigForm inicial={cfg} departamentos={departamentos} />

      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '2rem 0 0.35rem' }}>Roles y permisos</h2>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
        Crea roles con acceso acotado a pantallas puntuales — para gente del
        primer anillo del candidato (agenda, logística, rutas, etc.).
      </p>
      <RolesPanel roles={roles} />

      <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '2rem 0 0' }}>
        Las cuentas (incluidos los testigos) se crean en{' '}
        <Link href="/core/usuarios" style={{ color: '#1e40af', fontWeight: 600 }}>
          Usuarios y testigos
        </Link>.
      </p>
    </div>
  )
}
