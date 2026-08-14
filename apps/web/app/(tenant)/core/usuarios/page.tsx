import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { listarRoles, listarUsuarios } from '../configuracion/actions-roles'
import { listVoterOptions } from '../actions'
import { UsuariosPanel } from './_components/usuarios-panel'

export const metadata = { title: 'Usuarios y testigos' }

/**
 * Cuentas que entran al panel — solo ADMIN_CAMPANA.
 *
 * Vive en CORE y no dentro de Configuración porque crear testigos no es un
 * ajuste que se toca una vez: es trabajo de campaña, y antes de la elección se
 * hace decenas de veces. Enterrado en Configuración nadie lo encontraba.
 */
export default async function UsuariosPage() {
  await requireAuthOrRedirect(['ADMIN_CAMPANA'])
  const [roles, usuarios, electores] = await Promise.all([
    listarRoles(), listarUsuarios(), listVoterOptions(),
  ])

  const testigos = usuarios.filter(u => u.role === 'TESTIGO').length

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>
        Usuarios y testigos
      </h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Cuentas con acceso al panel y a la app del testigo. Hoy hay{' '}
        <strong>{testigos}</strong> testigo(s). Un testigo se crea acá y después
        se le asigna su mesa en Día E → Asignaciones.
      </p>
      <UsuariosPanel usuarios={usuarios} roles={roles} electores={electores} />
    </div>
  )
}
