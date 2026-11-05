import { getDobleFactor } from '@/app/_actions/doble-factor'
import { DobleFactor } from '@/app/_components/doble-factor'

export const metadata = { title: 'Seguridad de mi cuenta' }

/** La cuenta del superadmin abre todas las campañas: es la que más necesita el doble factor. */
export default async function SeguridadSuperadminPage() {
  const { activo } = await getDobleFactor()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Seguridad de mi cuenta</h1>
      <DobleFactor activoInicial={activo} />
    </div>
  )
}
