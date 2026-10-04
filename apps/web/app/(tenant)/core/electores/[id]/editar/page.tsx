import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getVoterEditable } from '../../../actions'
import { FormularioElector } from '../../_components/formulario-elector'

export const metadata = { title: 'Editar elector' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarElectorPage({ params }: Props) {
  const { id } = await params
  const elector = await getVoterEditable(id)
  if (!elector) notFound()

  return (
    <div style={{ maxWidth: '500px' }}>
      <Link href={`/core/electores/${id}`} style={{ color: '#64748b', fontSize: '0.875rem', textDecoration: 'none' }}>
        ← {elector.name}
      </Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0 1.5rem' }}>Editar elector</h1>
      <FormularioElector elector={elector} />
    </div>
  )
}
