import Link from 'next/link'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { REPORTES, type ReporteDef } from './_lib/catalogo'

export const metadata = { title: 'Reportes' }

export default async function ReportesPage() {
  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_REPORTES')
  const disponibles = REPORTES.filter((r) => !r.modulo || session.user.activeModules.includes(r.modulo))
  const grupos = [...new Set(disponibles.map((r) => r.grupo))]

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Reportes</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Cada reporte se puede ver, descargar en Excel e imprimir o guardar como PDF.
      </p>
      {grupos.map((g) => (
        <section key={g} style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6rem' }}>{g}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {disponibles.filter((r) => r.grupo === g).map((r) => <Tarjeta key={r.id} reporte={r} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

function Tarjeta({ reporte }: { reporte: ReporteDef }) {
  return (
    <Link href={reporte.href ?? `/core/reportes/${reporte.id}`} style={{
      display: 'block', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem',
      textDecoration: 'none', color: '#0f172a',
    }}>
      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{reporte.titulo}</div>
      <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.3rem' }}>{reporte.descripcion}</div>
    </Link>
  )
}
