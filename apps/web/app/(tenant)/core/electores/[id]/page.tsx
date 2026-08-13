import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@vectra/auth'
import { getVoterDetalle } from '../../actions'
import { getCoberturaPropiaEncuesta } from '@/app/(tenant)/encuestas/actions'
import { SelectorEstado } from '../_components/selector-estado'
import { BotonJefeDebate } from '../../_components/boton-jefe-debate'
import { VeredictoCompromiso } from '@/app/(tenant)/_components/veredicto-compromiso'

export const metadata = { title: 'Ficha de elector' }

interface Props {
  params: Promise<{ id: string }>
}

const COLORES_ESTADO: Record<string, { bg: string; text: string }> = {
  SIN_CONTACTAR: { bg: '#f1f5f9', text: '#475569' },
  CONTACTADO:    { bg: '#dbeafe', text: '#1e40af' },
  SIMPATIZANTE:  { bg: '#fef9c3', text: '#854d0e' },
  COMPROMETIDO:  { bg: '#dcfce7', text: '#166534' },
  VOTO_SEGURO:   { bg: '#bbf7d0', text: '#14532d' },
}

export default async function FichaElectorPage({ params }: Props) {
  const { id } = await params
  const elector = await getVoterDetalle(id)
  if (!elector) notFound()

  const session = await auth()
  const esAdminCampana = session?.user?.role === 'ADMIN_CAMPANA'

  // Best-effort: si el rol no califica (ej. TESTIGO) o falla, simplemente no se
  // muestra el dato — no es motivo para romper la ficha completa del elector.
  const cobertura = await getCoberturaPropiaEncuesta(id).catch(() => null)

  const c = COLORES_ESTADO[elector.commitmentStatus] ?? { bg: '#f1f5f9', text: '#475569' }

  return (
    <div style={{ maxWidth: '700px' }}>
      <Link href="/core/electores" style={{ color: '#64748b', fontSize: '0.875rem', textDecoration: 'none' }}>
        ← Electores
      </Link>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            {elector.name}
            {elector.isCandidate && (
              <span style={{
                marginLeft: '0.6rem', verticalAlign: 'middle', background: '#fef2f2', color: '#991b1b',
                padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
              }}>
                CANDIDATO
              </span>
            )}
            {elector.tieneAgenda && (
              <span style={{
                marginLeft: '0.6rem', verticalAlign: 'middle', background: '#eff6ff', color: '#1e40af',
                padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600,
              }}>
                JEFE DE DEBATE
              </span>
            )}
          </h1>
          {elector.apodo && (
            <div style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.15rem' }}>&ldquo;{elector.apodo}&rdquo;</div>
          )}
          {elector.leaderId && elector.leaderName && (
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.3rem' }}>
              Reporta a{' '}
              <Link href={`/core/lideres/${elector.leaderId}`} style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 600 }}>
                {elector.leaderName}
              </Link>
            </div>
          )}
        </div>
        <span style={{ background: c.bg, color: c.text, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {elector.commitmentStatus.replace('_', ' ')}
        </span>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Campo label="Teléfono" valor={elector.phone} />
        <Campo label="Dirección" valor={elector.address} />
        <Campo
          label="Último contacto"
          valor={elector.lastContact ? new Date(elector.lastContact).toLocaleDateString('es-CO') : null}
        />
        {elector.notes && <Campo label="Notas" valor={elector.notes} />}

        <div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.35rem' }}>Actualizar estado</div>
          <SelectorEstado voterId={elector.id} estadoActual={elector.commitmentStatus} />
        </div>

        {esAdminCampana && (
          <div>
            <BotonJefeDebate id={elector.id} tieneAgenda={elector.tieneAgenda} />
          </div>
        )}
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

      <VeredictoCompromiso voterId={elector.id} />
    </div>
  )
}

function Campo({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', color: valor ? '#0f172a' : '#94a3b8' }}>{valor ?? 'Sin registrar'}</div>
    </div>
  )
}
