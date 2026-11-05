import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { getDobleFactor } from '@/app/_actions/doble-factor'
import { DobleFactor } from '@/app/_components/doble-factor'

export const metadata = { title: 'Seguridad de mi cuenta' }

export default async function SeguridadPage() {
  await requireAuthOrRedirect(['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'PERSONALIZADO'])
  const { activo } = await getDobleFactor()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Seguridad de mi cuenta</h1>
      <DobleFactor activoInicial={activo} />
    </div>
  )
}
