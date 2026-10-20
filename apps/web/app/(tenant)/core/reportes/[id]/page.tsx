import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getReporte } from '../actions'
import { TablaReporte } from '../_components/tabla-reporte'

export const metadata = { title: 'Reporte' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReportePage({ params }: Props) {
  const { id } = await params
  const reporte = await getReporte(id)
  if (!reporte) notFound()

  return (
    <div>
      <Link href="/core/reportes" className="no-imprimir" style={{ color: '#64748b', fontSize: '0.875rem', textDecoration: 'none' }}>
        ← Reportes
      </Link>
      <div style={{ marginTop: '0.5rem' }}>
        <TablaReporte reporte={reporte} />
      </div>
    </div>
  )
}
