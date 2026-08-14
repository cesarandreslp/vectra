'use client'

import { useState } from 'react'
import { crearUsuario, alternarUsuarioActivo, vincularUsuarioAElector, type UsuarioView, type CrearUsuarioInput } from '../actions-roles'
import { type CustomRoleView } from '../actions-roles'

interface VoterOption { id: string; name: string; zone: string | null }

const ROLES_FIJOS: { value: CrearUsuarioInput['role']; label: string }[] = [
  { value: 'ADMIN_CAMPANA', label: 'Admin de campaña' },
  { value: 'COORDINADOR',   label: 'Coordinador' },
  { value: 'LIDER',         label: 'Líder' },
  { value: 'TESTIGO',       label: 'Testigo' },
]

export function UsuariosPanel({ usuarios: usuariosIniciales, roles, electores }: {
  usuarios: UsuarioView[]; roles: CustomRoleView[]; electores: VoterOption[]
}) {
  const [usuarios, setUsuarios] = useState(usuariosIniciales)
  const [creando, setCreando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<CrearUsuarioInput['role']>('COORDINADOR')
  const [customRoleId, setCustomRoleId] = useState('')
  const [voterId, setVoterId] = useState('')

  async function onCrear(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const res = await crearUsuario({ name, email, password, role, customRoleId: customRoleId || undefined, voterId: voterId || undefined })
    if (!res.success) { alert(res.error); setGuardando(false); return }
    setGuardando(false)
    location.reload()
  }

  async function onAlternar(id: string, activo: boolean) {
    const res = await alternarUsuarioActivo(id, !activo)
    if (!res.success) { alert(res.error); return }
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, isActive: !activo } : u)))
  }

  async function onVincular(id: string, voterId: string | null) {
    const res = await vincularUsuarioAElector(id, voterId)
    if (!res.success) { alert(res.error); return }
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, voterId } : u)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {usuarios.map((u) => (
        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.name ?? u.email}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {u.email} · {u.role === 'PERSONALIZADO' ? u.customRoleName : u.role}
              {!u.isActive && ' · Inactivo'}
            </div>
            {/* Sin elector no aparece en los desplegables de líder ni entra al PWA. */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.72rem', color: '#64748b' }}>
              Elector:
              <select
                value={u.voterId ?? ''}
                onChange={(e) => onVincular(u.id, e.target.value || null)}
                style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '0.15rem 0.3rem', fontSize: '0.72rem', maxWidth: 220 }}
              >
                <option value="">— sin vincular —</option>
                {electores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
          </div>
          <button
            onClick={() => onAlternar(u.id, u.isActive)}
            style={{
              border: '1px solid ' + (u.isActive ? '#fecaca' : '#bbf7d0'),
              background: u.isActive ? '#fef2f2' : '#f0fdf4', color: u.isActive ? '#991b1b' : '#166534',
              borderRadius: '6px', padding: '0.3rem 0.7rem', fontSize: '0.75rem', cursor: 'pointer',
            }}
          >
            {u.isActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      ))}

      {!creando ? (
        <button
          onClick={() => setCreando(true)}
          style={{ alignSelf: 'flex-start', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.9rem', fontSize: '0.8rem', cursor: 'pointer' }}
        >
          + Nuevo usuario
        </button>
      ) : (
        <form onSubmit={onCrear} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" required
            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Correo" required
            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Contraseña inicial" required
            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} />

          <select value={role} onChange={(e) => setRole(e.target.value as CrearUsuarioInput['role'])}
            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}>
            {ROLES_FIJOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            <option value="PERSONALIZADO">Rol personalizado…</option>
          </select>

          {role === 'PERSONALIZADO' && (
            <select value={customRoleId} onChange={(e) => setCustomRoleId(e.target.value)} required
              style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}>
              <option value="">Elige un rol...</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}

          {/* Para un TESTIGO el elector NO es opcional: la Registraduría lo
              identifica por su cédula, y la cédula vive en la ficha del elector. */}
          <select value={voterId} onChange={(e) => setVoterId(e.target.value)} required={role === 'TESTIGO'}
            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}>
            <option value="">
              {role === 'TESTIGO' ? 'Elige el elector que será testigo…' : 'Sin vincular a un elector (opcional)'}
            </option>
            {electores.map((v) => <option key={v.id} value={v.id}>{v.name}{v.zone ? ` · ${v.zone}` : ''}</option>)}
          </select>

          {role === 'TESTIGO' && (
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4 }}>
              Todo testigo es un elector de la campaña. Sin ficha de elector no tiene
              cédula, y sin cédula no se puede radicar ante la Registraduría.
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={guardando} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.9rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              {guardando ? 'Creando...' : 'Crear usuario'}
            </button>
            <button type="button" onClick={() => setCreando(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}
