import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { listarRoles, listarUsuarios } from '../configuracion/actions-roles'
import { listVoterOptions } from '../actions'
import { comunasParaTestigo, coberturaDeMesas, mesasDeTestigos } from '../../dia-e/actions'
import { UsuariosPanel } from './_components/usuarios-panel'
import { CoberturaMesas } from './_components/cobertura-mesas'
import { ImportarTestigos } from './_components/importar-testigos'

export const metadata = { title: 'Usuarios y testigos' }

/**
 * Cuentas que entran al panel — solo ADMIN_CAMPANA.
 *
 * Vive en CORE y no dentro de Configuración porque crear testigos no es un
 * ajuste que se toca una vez: es trabajo de campaña, y antes de la elección se
 * hace decenas de veces. Enterrado en Configuración nadie lo encontraba.
 */
export default async function UsuariosPage() {
  const session = await requireAuthOrRedirect(['ADMIN_CAMPANA'])

  // Sin DIA_E no hay mesas que vigilar: el bloque de asignación no se muestra.
  const conDiaE = session.user.activeModules.includes('DIA_E')

  const [roles, usuarios, electores, comunas, cobertura, mesas] = await Promise.all([
    listarRoles(), listarUsuarios(), listVoterOptions(),
    conDiaE ? comunasParaTestigo() : Promise.resolve([]),
    conDiaE ? coberturaDeMesas()   : Promise.resolve(null),
    conDiaE ? mesasDeTestigos()    : Promise.resolve({}),
  ])

  const testigos = usuarios.filter(u => u.role === 'TESTIGO').length

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>
        Usuarios y testigos
      </h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem', maxWidth: '640px' }}>
        Cuentas con acceso al panel y a la app del testigo. Hoy hay{' '}
        <strong>{testigos}</strong> testigo(s). Un testigo se crea acá y después
        se le asigna su mesa en Día E → Asignaciones.
      </p>
      {cobertura && <CoberturaMesas cobertura={cobertura} />}

      {conDiaE && (
        <div style={{ margin: '0 0 1rem' }}>
          <ImportarTestigos />
        </div>
      )}

      <UsuariosPanel usuarios={usuarios} roles={roles} electores={electores} comunas={comunas} mesas={mesas} />
    </div>
  )
}
