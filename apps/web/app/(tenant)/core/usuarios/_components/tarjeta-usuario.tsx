'use client'

import { type UsuarioView } from '../../configuracion/actions-roles'
import { AsignarMesa } from './asignar-mesa'
import type { ComunaConBarrios, MesaDeTestigo } from '../../../dia-e/actions'
import type { VoterOption } from './form-nuevo-usuario'

/** Una cuenta del equipo. Ocupa toda la celda que le da la grilla del panel. */
export function TarjetaUsuario({ u, electores, comunas, mesa, accent, onAlternar, onVincular }: {
  u: UsuarioView
  electores: VoterOption[]
  comunas: ComunaConBarrios[]
  /** Mesa que vigila, si es testigo y ya tiene. */
  mesa?: MesaDeTestigo
  /** Color del puesto (vista "Por puesto"): franja izquierda para agrupar de un vistazo. */
  accent?: string
  onAlternar: (id: string, activo: boolean) => void
  onVincular: (id: string, voterId: string | null) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.6rem', border: '1px solid #e2e8f0', borderLeft: accent ? `4px solid ${accent}` : '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem 0.9rem', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name ?? u.email}</div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.email} · {u.role === 'PERSONALIZADO' ? u.customRoleName : u.role}
              {!u.isActive && ' · Inactivo'}
            </div>
          </div>
          <button
            onClick={() => onAlternar(u.id, u.isActive)}
            style={{
              flexShrink: 0,
              border: '1px solid ' + (u.isActive ? '#fecaca' : '#bbf7d0'),
              background: u.isActive ? '#fef2f2' : '#f0fdf4', color: u.isActive ? '#991b1b' : '#166534',
              borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.72rem', cursor: 'pointer',
            }}
          >
            {u.isActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>

        {/* Sin elector no aparece en los desplegables de líder ni entra al PWA. */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#64748b' }}>
          Elector:
          <select
            value={u.voterId ?? ''}
            onChange={(e) => onVincular(u.id, e.target.value || null)}
            style={{ flex: 1, minWidth: 0, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0.15rem 0.3rem', fontSize: '0.72rem' }}
          >
            <option value="">— sin vincular —</option>
            {electores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
      </div>

      {/* Solo a los testigos: es el único rol que vigila una mesa. */}
      {u.role === 'TESTIGO' && comunas.length > 0 && (
        mesa
          ? <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>
              Mesa {mesa.numero} · {mesa.puesto}
            </div>
          : <AsignarMesa userId={u.id} voterId={u.voterId} comunas={comunas} />
      )}
    </div>
  )
}
