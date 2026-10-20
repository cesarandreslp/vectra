import Link from 'next/link'
import { listMesasEscrutinio, type EstadoMesa } from './actions'

export const metadata = { title: 'Escrutinio' }

interface Props {
  searchParams: Promise<{ zona?: string; estado?: string }>
}

const ESTADO: Record<EstadoMesa, { label: string; bg: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente', bg: '#f1f5f9', color: '#475569' },
  REVISADA:  { label: 'Sin cambios', bg: '#dcfce7', color: '#166534' },
  CORREGIDA: { label: 'Corregida', bg: '#fef3c7', color: '#92400e' },
}

/**
 * Borrador del escrutinio (E-24): el testigo ante la comisión escrutadora
 * recorre las mesas de su zona y registra lo que la comisión dejó en cada una.
 */
export default async function EscrutinioPage({ searchParams }: Props) {
  const params = await searchParams
  const { zonas, mesas } = await listMesasEscrutinio(params.zona || null)
  const visibles = params.estado ? mesas.filter((m) => m.estado === params.estado) : mesas
  const cuenta = (e: EstadoMesa) => mesas.filter((m) => m.estado === e).length

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Escrutinio (borrador E-24)</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
        Parte del preconteo (E-14). A medida que la comisión escrutadora revisa cada mesa, registra aquí lo que quedó:
        si cambió, el motivo. El consolidado se coteja con el E-26 en Reportes.
      </p>

      <form method="GET" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <select name="zona" defaultValue={params.zona ?? ''} style={campo}>
          <option value="">Todas las zonas</option>
          {zonas.map((z) => <option key={z.id} value={z.id}>Zona {z.code}{z.name ? ` (${z.name})` : ''}</option>)}
        </select>
        <select name="estado" defaultValue={params.estado ?? ''} style={campo}>
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO) as EstadoMesa[]).map((e) => <option key={e} value={e}>{ESTADO[e].label} ({cuenta(e)})</option>)}
        </select>
        <button type="submit" style={{ ...campo, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Filtrar</button>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {mesas.length} mesas · {cuenta('REVISADA') + cuenta('CORREGIDA')} revisadas · {cuenta('CORREGIDA')} corregidas
        </span>
      </form>

      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={celda}>Puesto</th><th style={celda}>Mesa</th>
              <th style={{ ...celda, textAlign: 'right' }}>Votos E-14</th><th style={{ ...celda, textAlign: 'right' }}>Votos escrutinio</th>
              <th style={celda}>Estado</th><th style={celda}></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((m) => {
              const dif = m.totalE14 !== null && m.totalEscrutinio !== null ? m.totalEscrutinio - m.totalE14 : 0
              return (
                <tr key={m.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={celda}>{m.puesto}</td>
                  <td style={celda}>{m.mesa}</td>
                  <td style={{ ...celda, textAlign: 'right' }}>{m.totalE14 ?? <span style={{ color: '#94a3b8' }}>sin E-14</span>}</td>
                  <td style={{ ...celda, textAlign: 'right' }}>
                    {m.totalEscrutinio ?? '—'}
                    {dif !== 0 && <span style={{ color: dif > 0 ? '#166534' : '#991b1b', marginLeft: 4 }}>({dif > 0 ? '+' : ''}{dif})</span>}
                  </td>
                  <td style={celda}>
                    <span style={{ background: ESTADO[m.estado].bg, color: ESTADO[m.estado].color, padding: '0.1rem 0.5rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600 }}>
                      {ESTADO[m.estado].label}
                    </span>
                  </td>
                  <td style={celda}><Link href={`/dia-e/escrutinio/${m.id}`} style={{ color: '#1e40af', fontWeight: 600 }}>Revisar</Link></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const celda: React.CSSProperties = { padding: '0.45rem 0.65rem' }
const campo: React.CSSProperties = { padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.82rem', background: '#fff' }
