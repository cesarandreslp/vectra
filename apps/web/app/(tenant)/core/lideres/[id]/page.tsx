import Link             from 'next/link'
import { notFound }    from 'next/navigation'
import { auth }        from '@vectra/auth'
import { listLeaders, listVoters, getArbolOrganizacion } from '../../actions'
import { getCoberturaPropiaEncuesta } from '@/app/(tenant)/encuestas/actions'
import { BarraProgreso } from '../_components/barra-progreso'
import { BotonCandidato } from '../_components/boton-candidato'
import { BotonJefeDebate } from '../../_components/boton-jefe-debate'
import { Organigrama }   from '../_components/organigrama'

export const metadata = { title: 'Ficha de líder' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function FichaLiderPage({ params }: Props) {
  const { id }  = await params
  const session = await auth()
  const esAdmin = ['ADMIN_CAMPANA', 'COORDINADOR'].includes(session?.user?.role ?? '')
  const esAdminCampana = session?.user?.role === 'ADMIN_CAMPANA'

  // `misDatos` busca puntualmente por id (funciona aunque el líder sea recién
  // creado y todavía no tenga followers, o ya no llegue al umbral).
  const [misDatos, datosElectores, arbol] = await Promise.all([
    listLeaders({ id }),
    listVoters({ leaderId: id }),
    getArbolOrganizacion(id),
  ])

  const lider = misDatos[0]
  if (!lider) notFound()

  // Best-effort — un rol sin acceso (ej. TESTIGO) simplemente no ve el dato.
  const cobertura = await getCoberturaPropiaEncuesta(id).catch(() => null)

  const { voters, total } = datosElectores

  // Conteo por estado de compromiso
  const conteoEstados = voters.reduce<Record<string, number>>((acc, v) => {
    acc[v.commitmentStatus] = (acc[v.commitmentStatus] ?? 0) + 1
    return acc
  }, {})

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <Link href="/core/lideres" style={{ color: '#64748b', fontSize: '0.875rem', textDecoration: 'none' }}>
            ← Líderes
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
            {lider.name}
            {lider.isCandidate && (
              <span style={{
                marginLeft: '0.6rem', verticalAlign: 'middle', background: '#fef2f2', color: '#991b1b',
                padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
              }}>
                CANDIDATO
              </span>
            )}
            {lider.tieneAgenda && (
              <span style={{
                marginLeft: '0.6rem', verticalAlign: 'middle', background: '#eff6ff', color: '#1e40af',
                padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
              }}>
                JEFE DE DEBATE
              </span>
            )}
          </h1>
          {lider.zone && <div style={{ color: '#64748b', fontSize: '0.875rem' }}>{lider.zone}</div>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {esAdminCampana && <BotonCandidato id={id} esCandidato={lider.isCandidate} />}
          {esAdminCampana && <BotonJefeDebate id={id} tieneAgenda={lider.tieneAgenda} />}
          <Link
            href={`/core/lideres/${id}/arbol`}
            style={{
              background: '#f1f5f9', color: '#475569', padding: '0.5rem 1rem',
              borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem',
              border: '1px solid #e2e8f0',
            }}
          >
            Árbol de captación →
          </Link>
          {esAdmin && (
            <Link
              href={`/core/electores/nuevo?leaderId=${id}`}
              style={{
                background: '#e2e8f0', color: '#0f172a', padding: '0.5rem 1rem',
                borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem',
              }}
            >
              + Elector
            </Link>
          )}
          {esAdmin && (
            <Link
              href={`/core/lideres/${id}/editar`}
              style={{
                background: '#0f172a', color: '#fff', padding: '0.5rem 1rem',
                borderRadius: '6px', textDecoration: 'none', fontSize: '0.875rem',
              }}
            >
              Editar
            </Link>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <Metrica titulo="Total electores" valor={String(lider.totalElectores)} />
        <Metrica titulo="Comprometidos"   valor={String(lider.comprometidos)} />
        <Metrica titulo="Meta de votos"   valor={String(lider.targetVotes)} />
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>Avance</div>
          <BarraProgreso valor={lider.comprometidos} meta={lider.targetVotes} pct={lider.pctAvance} />
        </div>
      </div>

      {cobertura && cobertura.captados > 0 && (
        <div style={{
          background: cobertura.respondieron > 0 ? '#eef2ff' : '#f8fafc',
          border: `1px solid ${cobertura.respondieron > 0 ? '#c7d2fe' : '#e2e8f0'}`,
          borderRadius: '8px', padding: '0.875rem 1rem', marginBottom: '1.5rem', fontSize: '0.85rem',
        }}>
          <strong>{cobertura.respondieron} de {cobertura.captados}</strong> personas que registró con su propio QR/link respondieron la encuesta activa.
        </div>
      )}

      {/* Organigrama — toda la cadena de gente con su propia red debajo, no
          solo quienes ya califican como líder (un conector con <10 directos
          igual debe verse, para no cortar la cadena visualmente). */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Organigrama</h2>
        {arbol ? <Organigrama raiz={arbol} /> : (
          <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No se pudo cargar el organigrama.</div>
        )}
      </div>

      {/* Distribución por estado */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Distribución por estado</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {Object.entries(conteoEstados).map(([estado, cnt]) => (
            <div
              key={estado}
              style={{
                background: COLORES_ESTADO[estado]?.bg ?? '#f1f5f9',
                color:      COLORES_ESTADO[estado]?.text ?? '#475569',
                padding:    '0.4rem 0.75rem',
                borderRadius: '6px',
                fontSize:   '0.8rem',
                fontWeight: 600,
              }}
            >
              {estado}: {cnt}
            </div>
          ))}
        </div>
      </div>

      {/* Lista de electores */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Electores ({total})</h2>
          {esAdmin && (
            <Link href={`/core/electores/nuevo?leaderId=${id}`} style={{ color: '#1e40af', fontSize: '0.875rem' }}>
              + Agregar elector
            </Link>
          )}
        </div>
        {voters.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            No hay electores asignados a este líder.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <Th>Nombre</Th>
                <Th>Estado</Th>
                <Th>Último contacto</Th>
              </tr>
            </thead>
            <tbody>
              {voters.map((v) => (
                <tr key={v.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <Td>
                    <Link href={`/core/electores/${v.id}`} style={{ color: '#0f172a', fontWeight: 500, textDecoration: 'none' }}>
                      {v.name}
                    </Link>
                  </Td>
                  <Td>
                    <EstadoBadge status={v.commitmentStatus} />
                  </Td>
                  <Td>
                    {v.lastContact
                      ? new Date(v.lastContact).toLocaleDateString('es-CO')
                      : <span style={{ color: '#94a3b8' }}>Sin contacto</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const COLORES_ESTADO: Record<string, { bg: string; text: string }> = {
  SIN_CONTACTAR: { bg: '#f1f5f9', text: '#475569' },
  CONTACTADO:    { bg: '#dbeafe', text: '#1e40af' },
  SIMPATIZANTE:  { bg: '#fef9c3', text: '#854d0e' },
  COMPROMETIDO:  { bg: '#dcfce7', text: '#166534' },
  VOTO_SEGURO:   { bg: '#bbf7d0', text: '#14532d' },
}

function Metrica({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>{titulo}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{valor}</div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.875rem' }}>{children}</td>
}

function EstadoBadge({ status }: { status: string }) {
  const c = COLORES_ESTADO[status] ?? { bg: '#f1f5f9', text: '#475569' }
  return (
    <span style={{ background: c.bg, color: c.text, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
      {status.replace('_', ' ')}
    </span>
  )
}
