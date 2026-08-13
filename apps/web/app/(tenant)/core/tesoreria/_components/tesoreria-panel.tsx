import Link from 'next/link'
import type { TesoreriaView } from '../actions'

const cop = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

/** Vista compuesta de solo lectura: cada bloque enlaza a donde se edita. */
export function TesoreriaPanel({ data }: { data: TesoreriaView }) {
  const { presupuestos, gastado, recaudado, balance, tope, porcentajeTope, informes, tesorero } = data
  const topeAlto = porcentajeTope != null && porcentajeTope >= 80

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      <Bloque titulo="Presupuestos de actividades" editar="/core/presupuestos" nota="Planear y aprobar el gasto de cada actividad antes de ejecutarla (CORE).">
        <div style={grid}>
          <Tile label="Pendientes de aprobación" valor={`${presupuestos.pendientes}`} alerta={presupuestos.pendientes > 0} />
          <Tile label="Aprobados" valor={`${presupuestos.aprobados}`} />
        </div>
      </Bloque>

      <Bloque titulo="Movimiento" editar="/finanzas" nota="Gastos con comprobante y donaciones registradas (FINANZAS).">
        <div style={grid}>
          <Tile label="Gastado" valor={cop(gastado)} />
          <Tile label="Recaudado" valor={cop(recaudado)} />
          <Tile label="Balance" valor={cop(balance)} alerta={balance < 0} />
        </div>
      </Bloque>

      <Bloque titulo="Tope legal (CNE)" editar="/finanzas/configuracion" nota="Límite de gasto según cargo y circunscripción.">
        {tope == null ? (
          <p style={vacio}>Sin tope configurado.</p>
        ) : (
          <div style={grid}>
            <Tile label="Tope" valor={cop(tope)} />
            <Tile label="Usado" valor={`${Math.round(porcentajeTope!)}%`} alerta={topeAlto} />
          </div>
        )}
      </Bloque>

      <Bloque titulo="Cierre" editar="/finanzas/informes" nota="Informes al CNE y quién responde por las cuentas.">
        <div style={grid}>
          <Tile label="Informes generados" valor={`${informes}`} />
          <div style={tileBase}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: tesorero ? '#64748b' : '#b45309' }}>Tesorero</p>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.95rem', fontWeight: 600, color: tesorero ? '#0f172a' : '#b45309' }}>
              {tesorero ?? 'Sin asignar'}
              {!tesorero && <> · <Link href="/finanzas/configuracion" style={{ fontSize: '0.75rem', fontWeight: 400, color: '#1e40af' }}>asignar</Link></>}
            </p>
          </div>
        </div>
      </Bloque>
    </div>
  )
}

function Bloque({ titulo, nota, editar, children }: { titulo: string; nota: string; editar: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{titulo}</span>
        <Link href={editar} style={{ fontSize: '0.75rem', color: '#1e40af', whiteSpace: 'nowrap' }}>ir a {editar} →</Link>
      </div>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#64748b' }}>{nota}</p>
      {children}
    </div>
  )
}

function Tile({ label, valor, alerta }: { label: string; valor: string; alerta?: boolean }) {
  return (
    <div style={{ ...tileBase, background: alerta ? '#fffbeb' : '#f8fafc' }}>
      <p style={{ margin: 0, fontSize: '0.75rem', color: alerta ? '#b45309' : '#64748b' }}>{label}</p>
      <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: 600, color: alerta ? '#b45309' : '#0f172a' }}>{valor}</p>
    </div>
  )
}

const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }
const tileBase: React.CSSProperties = { background: '#f8fafc', borderRadius: 8, padding: '0.6rem 0.75rem' }
const vacio: React.CSSProperties = { margin: 0, fontSize: '0.85rem', color: '#94a3b8' }
