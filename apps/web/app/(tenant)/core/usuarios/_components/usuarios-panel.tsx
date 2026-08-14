'use client'

import { useState } from 'react'
import { alternarUsuarioActivo, vincularUsuarioAElector, type UsuarioView } from '../../configuracion/actions-roles'
import { type CustomRoleView } from '../../configuracion/actions-roles'
import { FormNuevoUsuario, type VoterOption } from './form-nuevo-usuario'
import type { ComunaConBarrios } from '../../../dia-e/actions'

export function UsuariosPanel({ usuarios: usuariosIniciales, roles, electores, comunas }: {
  usuarios: UsuarioView[]; roles: CustomRoleView[]; electores: VoterOption[]
  comunas: ComunaConBarrios[]
}) {
  const [usuarios, setUsuarios] = useState(usuariosIniciales)
  const [creando, setCreando] = useState(false)

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
        <FormNuevoUsuario roles={roles} electores={electores} comunas={comunas} onCancelar={() => setCreando(false)} />
      )}
    </div>
  )
}
