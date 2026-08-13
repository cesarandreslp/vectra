import Link from 'next/link'
import { listCandidates, createCandidate, deleteCandidate, actualizarDatosTarjeton } from '../../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { requiereFotoYAgrupacion } from '@/lib/e14'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb } from '@vectra/db'

export default async function ConfiguracionDiaEPage() {
  const session = await requireModuleOrRedirect('DIA_E', ['ADMIN_CAMPANA'])

  const db  = getTenantDb(await getTenantConnection(session.user.tenantId))
  const cfg = await db.tenantConfig.findUnique({
    where:  { tenantId: session.user.tenantId },
    select: { electionOffice: true },
  })
  const cargo      = cfg?.electionOffice ?? null
  const exigeFoto  = requiereFotoYAgrupacion(cargo)

  const candidates = await listCandidates()
  const propio     = candidates.find(c => c.isOwn)
  const rivales    = candidates.filter(c => !c.isOwn)

  // Para cargos uninominales, un candidato sin foto o sin agrupación deja el
  // acta incompleta — el testigo no puede identificar el renglón.
  const incompletos = exigeFoto
    ? candidates.filter(c => !c.photoUrl || !c.party)
    : []

  async function handleCreate(formData: FormData) {
    'use server'
    await createCandidate(formData)
  }

  async function handleActualizar(formData: FormData) {
    'use server'
    await actualizarDatosTarjeton(formData)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '700px' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
        Configuración — Día E
      </h1>

      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
        Arma el tarjetón antes del día de la elección: tu candidato se toma de
        CORE, los rivales se registran acá. El número es el del tarjetón y
        define el orden de los renglones en el E-14 del testigo.
        {cargo && <> Cargo en disputa: <strong>{cargo}</strong>.</>}
      </p>

      {exigeFoto && incompletos.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '0.9rem 1.1rem', fontSize: '0.85rem', color: '#92400e' }}>
          <strong>Faltan datos del tarjetón.</strong> En elecciones de {cargo?.toLowerCase()} el
          testigo identifica el renglón por la foto y el logo de la agrupación, no leyendo el
          nombre. Sin eso puede transcribir votos en la fila equivocada. Incompletos:{' '}
          {incompletos.map(c => c.name).join(', ')}.
        </div>
      )}

      {/* Nuestro candidato — nombre viene de CORE; foto y agrupación se completan acá */}
      <div style={{
        background: propio ? '#eff6ff' : '#fffbeb',
        border: `1px solid ${propio ? '#bfdbfe' : '#fde68a'}`,
        borderRadius: '12px', padding: '1.25rem',
      }}>
        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, letterSpacing: '1px' }}>
          NUESTRO CANDIDATO
        </div>
        {propio ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {propio.photoUrl
                ? <img src={propio.photoUrl} alt="" style={{ width: '48px', height: '58px', objectFit: 'cover', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                : <div style={{ width: '48px', height: '58px', border: '1px dashed #94a3b8', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#94a3b8' }}>sin foto</div>}
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{propio.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#64748b' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {propio.partyLogoUrl && <img src={propio.partyLogoUrl} alt="" style={{ height: '18px', width: 'auto', objectFit: 'contain' }} />}
                  {propio.party ?? <span style={{ color: '#b45309' }}>sin agrupación</span>} · Nº {propio.order}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>
              El nombre se toma de CORE — para cambiarlo, marca otro elector como candidato en{' '}
              <Link href="/core/lideres" style={{ color: '#1e40af' }}>su ficha</Link>.
              Foto, agrupación y número del tarjetón se completan aquí:
            </div>
            <FormTarjeton candidato={propio} action={handleActualizar} />
          </>
        ) : (
          <div style={{ fontSize: '0.85rem', color: '#92400e', marginTop: '0.35rem' }}>
            Todavía no has marcado a nadie como candidato de la campaña. Hazlo en{' '}
            <Link href="/core/lideres" style={{ color: '#92400e', fontWeight: 600 }}>CORE → ficha del elector</Link>{' '}
            y aparecerá aquí y en el formulario E-14 del testigo.
          </div>
        )}
      </div>

      {/* Formulario nuevo rival */}
      <form
        action={handleCreate}
        style={{
          background: '#fff', borderRadius: '12px', padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1rem', color: '#334155' }}>Agregar candidato rival</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="order" style={labelStyle}>Nº en el tarjetón</label>
            <input id="order" name="order" type="number" min="0" defaultValue="0" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="party" style={labelStyle}>
              Agrupación (partido o movimiento){exigeFoto && <span style={{ color: '#b91c1c' }}> *</span>}
            </label>
            <input id="party" name="party" required={exigeFoto} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="name" style={labelStyle}>Nombre del candidato</label>
            <input id="name" name="name" required style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="photo" style={labelStyle}>
              Foto del candidato{exigeFoto && <span style={{ color: '#b91c1c' }}> *</span>}
            </label>
            <input id="photo" name="photo" type="file" accept="image/*" required={exigeFoto} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="partyLogo" style={labelStyle}>Logo de la agrupación</label>
            <input id="partyLogo" name="partyLogo" type="file" accept="image/*" style={inputStyle} />
          </div>
        </div>

        <button type="submit" style={{
          padding: '0.75rem', fontSize: '0.875rem', borderRadius: '6px',
          border: 'none', background: '#1e40af', color: '#fff', cursor: 'pointer',
          fontWeight: 600, alignSelf: 'flex-start',
        }}>
          Agregar rival
        </button>
      </form>

      {/* Tarjetón completo — como lo verá el testigo */}
      {candidates.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflowX: 'auto',
        }}>
          <div style={{ padding: '1rem 1rem 0', fontSize: '0.8rem', color: '#64748b' }}>
            Así aparecerá el tarjetón en el E-14 del testigo ({candidates.length} candidato(s)):
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nº', 'Foto', 'Agrupación', 'Candidato', 'Acciones'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidates.map(c => (
                <CandidateRow key={c.id} candidate={c} exigeFoto={exigeFoto} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface CandidatoTarjeton {
  id: string; name: string; party: string | null
  partyLogoUrl: string | null; photoUrl: string | null
  isOwn: boolean; order: number
}

/** Completa foto / agrupación / número — sirve igual para el propio y los rivales. */
function FormTarjeton({ candidato, action }: {
  candidato: CandidatoTarjeton
  action: (formData: FormData) => Promise<void>
}) {
  return (
    <form action={action} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
      <input type="hidden" name="id" value={candidato.id} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <label style={{ ...labelStyle, fontSize: '0.7rem' }}>Nº</label>
        <input name="order" type="number" min="0" defaultValue={candidato.order} style={{ ...inputStyle, width: '64px' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: '140px' }}>
        <label style={{ ...labelStyle, fontSize: '0.7rem' }}>Agrupación</label>
        <input name="party" defaultValue={candidato.party ?? ''} placeholder="Partido o movimiento" style={inputStyle} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: '150px' }}>
        <label style={{ ...labelStyle, fontSize: '0.7rem' }}>Foto</label>
        <input name="photo" type="file" accept="image/*" style={{ ...inputStyle, padding: '0.35rem' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: '150px' }}>
        <label style={{ ...labelStyle, fontSize: '0.7rem' }}>Logo agrupación</label>
        <input name="partyLogo" type="file" accept="image/*" style={{ ...inputStyle, padding: '0.35rem' }} />
      </div>
      <button type="submit" style={{
        padding: '0.5rem 0.9rem', fontSize: '0.8rem', borderRadius: '6px', border: 'none',
        background: '#0f172a', color: '#fff', cursor: 'pointer', fontWeight: 600,
      }}>
        Guardar
      </button>
    </form>
  )
}

function CandidateRow({ candidate: c, exigeFoto }: {
  candidate: CandidatoTarjeton
  exigeFoto: boolean
}) {
  async function handleDelete() {
    'use server'
    await deleteCandidate(c.id)
  }

  const faltaFoto  = exigeFoto && !c.photoUrl
  const faltaGrupo = exigeFoto && !c.party

  return (
    <tr style={{ background: c.isOwn ? '#eff6ff' : undefined }}>
      <td style={{ ...tdStyle, fontWeight: 700, textAlign: 'center' }}>{c.order}</td>
      <td style={tdStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {c.photoUrl
          ? <img src={c.photoUrl} alt="" style={{ width: '32px', height: '38px', objectFit: 'cover', borderRadius: '3px', border: '1px solid #cbd5e1' }} />
          : <span style={{ fontSize: '0.7rem', color: faltaFoto ? '#b91c1c' : '#94a3b8' }}>{faltaFoto ? 'falta' : '—'}</span>}
      </td>
      <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {c.partyLogoUrl && <img src={c.partyLogoUrl} alt="" style={{ height: '18px', width: 'auto', maxWidth: '44px', objectFit: 'contain' }} />}
          <span style={{ color: faltaGrupo ? '#b91c1c' : undefined }}>
            {c.party ?? (faltaGrupo ? 'falta' : '—')}
          </span>
        </div>
      </td>
      <td style={{ ...tdStyle, fontWeight: c.isOwn ? 600 : 400 }}>
        {c.name}
        {c.isOwn && (
          <span style={{
            marginLeft: '0.5rem', background: '#1e40af', color: '#fff',
            padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700,
          }}>
            NUESTRO
          </span>
        )}
      </td>
      <td style={tdStyle}>
        {c.isOwn ? (
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Nombre desde CORE</span>
        ) : (
          <form action={handleDelete} style={{ display: 'inline' }}>
            <button type="submit" style={{
              padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px',
              border: '1px solid #fecaca', background: '#fff', color: '#ef4444', cursor: 'pointer',
            }}>
              Eliminar
            </button>
          </form>
        )}
      </td>
    </tr>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem', color: '#334155', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', fontSize: '0.875rem', borderRadius: '6px',
  border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box',
}
const thStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', textAlign: 'left', fontSize: '0.75rem',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9',
}
