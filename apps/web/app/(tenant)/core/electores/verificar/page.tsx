import { auth } from '@vectra/auth'
import { redirect } from 'next/navigation'
import { electoresSinVerificar } from '../../actions-censo'
import { ColaVerificacion } from '../_components/cola-verificacion'

export const metadata = { title: 'Verificar censo' }

export default async function VerificarCensoPage() {
  const session = await auth()
  if (!['ADMIN_CAMPANA', 'COORDINADOR'].includes(session?.user?.role ?? '')) redirect('/core/electores')

  const electores = await electoresSinVerificar()
  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Verificar en el censo</h1>
      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem', maxWidth: '640px' }}>
        Consulta cada elector en la Registraduría. Con la extensión instalada el resultado llega solo
        y la cola pasa al siguiente. En este computador; el elector y el líder en la calle solo registran.
      </p>
      <ColaVerificacion electores={electores} />
    </div>
  )
}
