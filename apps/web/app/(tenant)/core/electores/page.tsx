import Link                        from 'next/link'
import { auth }                    from '@vectra/auth'
import { listVoters, listLeaders } from '../actions'
import { SelectorEstado }          from './_components/selector-estado'

export const metadata = { title: 'Electores' }

interface Props {
  searchParams: Promise<{ page?: string; status?: string; leaderId?: string; q?: string }>
}

export default async function ElectoresPage({ searchParams }: Props) {
  const params  = await searchParams
  const page    = Number(params.page ?? 1)
  const session = await auth()
  const esAdmin = ['ADMIN_CAMPANA', 'COORDINADOR'].includes(session?.user?.role ?? '')

  const [{ voters, total, pages }, lideres] = await Promise.all([
    listVoters(
      {
        commitmentStatus: params.status as any,
        leaderId:         params.leaderId,
        search:           params.q,
      },
      { page, pageSize: 50 },
    ),
    listLeaders(),
  ])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Electores</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {esAdmin && (
            <>
              <Link
                href="/core/importar"
                style={{
                  background: '#f1f5f9', color: '#475569', padding: '0.5rem 1rem',
                  borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem', border: '1px solid #e2e8f0',
                }}
              >
                Importar CSV
              </Link>
              <Link
                href="/core/electores/nuevo"
                style={{
                  background: '#0f172a', color: '#fff', padding: '0.5rem 1rem',
                  borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem',
                }}
              >
                + Nuevo elector
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <form method="GET" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          name="q" defaultValue={params.q} placeholder="Buscar por nombre o cédula..."
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem', flex: '1', minWidth: '180px' }}
        />
        <select
          name="status" defaultValue={params.status ?? ''}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem', background: '#fff' }}
        >
          <option value="">Todos los estados</option>
          <option value="SIN_CONTACTAR">Sin contactar</option>
          <option value="CONTACTADO">Contactado</option>
          <option value="SIMPATIZANTE">Simpatizante</option>
          <option value="COMPROMETIDO">Comprometido</option>
          <option value="VOTO_SEGURO">Voto seguro</option>
        </select>
        <select
          name="leaderId" defaultValue={params.leaderId ?? ''}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem', background: '#fff' }}
        >
          <option value="">Todos los líderes</option>
          {lideres.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <button
          type="submit"
          style={{
            background: '#0f172a', color: '#fff', padding: '0.5rem 1rem',
            borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.875rem',
          }}
        >
          Filtrar
        </button>
      </form>

      {/* Contador */}
      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
        {total} electores · Página {page} de {pages}
      </div>

      {/* Tabla */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        {voters.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            No se encontraron electores con los filtros seleccionados.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <Th>Nombre</Th>
                <Th>Estado</Th>
                <Th>Último contacto</Th>
                <Th>Actualizar estado</Th>
              </tr>
            </thead>
            <tbody>
              {voters.map((v) => (
                <tr key={v.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <Td>
                    <Link href={`/core/electores/${v.id}`} style={{ fontWeight: 500, color: '#0f172a', textDecoration: 'none' }}>
                      {v.name}
                    </Link>
                    {v.notes && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{v.notes}</div>
                    )}
                  </Td>
                  <Td><EstadoBadge status={v.commitmentStatus} /></Td>
                  <Td>
                    {v.lastContact
                      ? new Date(v.lastContact).toLocaleDateString('es-CO')
                      : <span style={{ color: '#94a3b8' }}>Sin contacto</span>}
                  </Td>
                  <Td>
                    <SelectorEstado voterId={v.id} estadoActual={v.commitmentStatus as any} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`?page=${p}${params.status ? `&status=${params.status}` : ''}${params.leaderId ? `&leaderId=${params.leaderId}` : ''}${params.q ? `&q=${params.q}` : ''}`}
              style={{
                padding:        '0.25rem 0.75rem',
                borderRadius:   '6px',
                border:         '1px solid #e2e8f0',
                textDecoration: 'none',
                fontSize:       '0.875rem',
                background:     p === page ? '#0f172a' : '#fff',
                color:          p === page ? '#fff' : '#475569',
              }}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.875rem', verticalAlign: 'middle' }}>{children}</td>
}

const COLORES: Record<string, { bg: string; text: string }> = {
  SIN_CONTACTAR: { bg: '#f1f5f9', text: '#475569' },
  CONTACTADO:    { bg: '#dbeafe', text: '#1e40af' },
  SIMPATIZANTE:  { bg: '#fef9c3', text: '#854d0e' },
  COMPROMETIDO:  { bg: '#dcfce7', text: '#166534' },
  VOTO_SEGURO:   { bg: '#bbf7d0', text: '#14532d' },
}

function EstadoBadge({ status }: { status: string }) {
  const c = COLORES[status] ?? { bg: '#f1f5f9', text: '#475569' }
  return (
    <span style={{ background: c.bg, color: c.text, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
      {status.replace('_', ' ')}
    </span>
  )
}
