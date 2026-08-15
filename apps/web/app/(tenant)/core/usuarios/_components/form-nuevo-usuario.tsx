'use client'

import { useState } from 'react'
import { crearUsuario, type CrearUsuarioInput } from '../../configuracion/actions-roles'
import type { CustomRoleView } from '../../configuracion/actions-roles'
import type { ComunaConBarrios } from '../../../dia-e/actions'
import { SelectorMesa } from './selector-mesa'

export interface VoterOption { id: string; name: string; zone: string | null }

const ROLES_FIJOS: { value: CrearUsuarioInput['role']; label: string }[] = [
  { value: 'ADMIN_CAMPANA', label: 'Admin de campaña' },
  { value: 'COORDINADOR',   label: 'Coordinador' },
  { value: 'LIDER',         label: 'Líder' },
  { value: 'TESTIGO',       label: 'Testigo' },
]

/**
 * Alta de una cuenta del panel.
 *
 * Para un TESTIGO lo normal es que sea gente nueva: se escribe su cédula y se le
 * arma la ficha de elector colgada del candidato. Escogerlo del padrón es el
 * camino secundario, para quien ya está cargado.
 */
export function FormNuevoUsuario({ roles, electores, comunas, onCancelar }: {
  roles: CustomRoleView[]; electores: VoterOption[]
  /** Vacío = la campaña no tiene DIA_E activo: no hay mesas que asignar. */
  comunas: ComunaConBarrios[]
  onCancelar: () => void
}) {
  const [guardando, setGuardando] = useState(false)
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState<CrearUsuarioInput['role']>('COORDINADOR')
  const [customRoleId, setCustomRoleId] = useState('')
  const [voterId, setVoterId]   = useState('')
  const [cedula, setCedula]     = useState('')
  const [phone, setPhone]       = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [delPadron, setDelPadron] = useState(false)
  const [votingTableId, setVotingTableId] = useState('')
  const [tambienVotaAhi, setTambienVotaAhi] = useState(true)

  const esTestigo = role === 'TESTIGO'

  // Del padrón el nombre ya está en la ficha del elector: pedirlo otra vez es
  // pedir un dato que el sistema ya tiene, y da lugar a que queden distintos.
  const pideNombre = !delPadron || !voterId

  async function onCrear(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const res = await crearUsuario({
      // Vacío = que lo tome del elector. No se manda lo que quedó escrito antes
      // de cambiar de camino.
      name: pideNombre ? name : '',
      email, password, role,
      customRoleId: customRoleId || undefined,
      // Solo se manda el camino elegido: mandar los dos deja ambiguo qué gana.
      voterId: delPadron ? (voterId || undefined) : undefined,
      cedula:  !delPadron && esTestigo ? cedula : undefined,
      phone:   !delPadron && esTestigo ? phone  : undefined,
      birthDate: esTestigo ? (birthDate || undefined) : undefined,
      votingTableId:  esTestigo ? (votingTableId || undefined) : undefined,
      tambienVotaAhi: esTestigo && tambienVotaAhi,
    })
    if (res.success && res.aviso) alert(res.aviso)
    if (!res.success) { alert(res.error); setGuardando(false); return }
    location.reload()
  }

  return (
    <form onSubmit={onCrear} style={formStyle}>
      <select value={role} onChange={(e) => setRole(e.target.value as CrearUsuarioInput['role'])} style={inputStyle}>
        {ROLES_FIJOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        <option value="PERSONALIZADO">Rol personalizado…</option>
      </select>

      {role === 'PERSONALIZADO' && (
        <select value={customRoleId} onChange={(e) => setCustomRoleId(e.target.value)} required style={inputStyle}>
          <option value="">Elige un rol...</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}

      {esTestigo && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4 }}>
            Todo testigo queda como elector de la campaña — de ahí sale la cédula
            que pide la Registraduría.
          </p>

          <label style={radioStyle}>
            <input type="radio" checked={!delPadron} onChange={() => setDelPadron(false)} />
            Es alguien nuevo — se le crea la ficha bajo el candidato
          </label>

          {!delPadron && (
            <>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" required style={inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="Cédula" required
                  style={{ ...inputStyle, flex: 1, minWidth: '130px' }} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (opcional)"
                  style={{ ...inputStyle, flex: 1, minWidth: '130px' }} />
              </div>
            </>
          )}

          <label style={radioStyle}>
            <input type="radio" checked={delPadron} onChange={() => setDelPadron(true)} />
            Ya está en el padrón
          </label>

          {delPadron && (
            <select value={voterId} onChange={(e) => setVoterId(e.target.value)} required style={inputStyle}>
              <option value="">Elige el elector que será testigo…</option>
              {electores.map((v) => <option key={v.id} value={v.id}>{v.name}{v.zone ? ` · ${v.zone}` : ''}</option>)}
            </select>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem', color: '#334155' }}>
            Fecha de nacimiento
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
              required={!delPadron} max={hoyISO()} style={inputStyle} />
            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
              {delPadron
                ? 'Solo si su ficha todavía no la tiene. Debe ser mayor de edad (18+).'
                : 'Define si es apto para votar (18+) y es parte de su acceso como testigo.'}
            </span>
          </label>
        </div>
      )}

      {esTestigo && comunas.length > 0 && (
        <>
          <SelectorMesa
            comunas={comunas}
            voterId={delPadron ? (voterId || undefined) : undefined}
            onChange={setVotingTableId}
          />
          {votingTableId && (
            <label style={radioStyle}>
              <input type="checkbox" checked={tambienVotaAhi} onChange={(e) => setTambienVotaAhi(e.target.checked)} />
              También queda inscrito para votar en esa mesa
            </label>
          )}
        </>
      )}

      {/* Para el resto de roles el elector es opcional: sin él no salen en los
          desplegables de líder ni entran al PWA, pero pueden usar el panel. */}
      {!esTestigo && (
        <select value={voterId} onChange={(e) => { setVoterId(e.target.value); setDelPadron(Boolean(e.target.value)) }} style={inputStyle}>
          <option value="">Sin vincular a un elector (opcional)</option>
          {electores.map((v) => <option key={v.id} value={v.id}>{v.name}{v.zone ? ` · ${v.zone}` : ''}</option>)}
        </select>
      )}

      {pideNombre && !esTestigo && (
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" required style={inputStyle} />
      )}

      {/* Con qué entra al sistema. Hace falta siempre: el elector del padrón
          tiene ficha, no cuenta — la cuenta es esto. */}
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Correo" required style={inputStyle} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Contraseña inicial" required style={inputStyle} />

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={guardando} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.9rem', fontSize: '0.8rem', cursor: 'pointer' }}>
          {guardando ? 'Creando...' : 'Crear usuario'}
        </button>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

const formStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.9rem 1rem',
  display: 'flex', flexDirection: 'column', gap: '0.6rem',
}
const inputStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem',
}
const radioStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#334155',
}

/** Hoy en YYYY-MM-DD, para topar el date input y no admitir fechas futuras. */
const hoyISO = () => new Date().toISOString().slice(0, 10)
