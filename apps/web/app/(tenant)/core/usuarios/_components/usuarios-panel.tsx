'use client'

import { useMemo, useState } from 'react'
import { alternarUsuarioActivo, vincularUsuarioAElector, type UsuarioView, type CustomRoleView } from '../../configuracion/actions-roles'
import { FormNuevoUsuario, type VoterOption } from './form-nuevo-usuario'
import { TarjetaUsuario } from './tarjeta-usuario'
import type { ComunaConBarrios, MesaDeTestigo } from '../../../dia-e/actions'

type Vista = 'lista' | 'puesto'

/** Grilla que se reparte sola por el ancho: nunca una columna fija. */
const grid: React.CSSProperties = {
  display: 'grid', gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
}

/** Un color por puesto en la vista "Por puesto", para ver de un golpe dónde
 * termina un grupo y empieza el siguiente. Se cicla si hay más puestos que colores. */
const PALETA = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#b45309']

export function UsuariosPanel({ usuarios: usuariosIniciales, roles, electores, comunas, mesas }: {
  usuarios: UsuarioView[]; roles: CustomRoleView[]; electores: VoterOption[]
  comunas: ComunaConBarrios[]
  /** userId → mesa que vigila. Sin entrada = sin mesa asignada. */
  mesas: Record<string, MesaDeTestigo>
}) {
  const [usuarios, setUsuarios] = useState(usuariosIniciales)
  const [creando, setCreando] = useState(false)
  const [vista, setVista] = useState<Vista>('lista')

  // Agrupar por puesto solo tiene sentido si hay testigos con mesa.
  const hayAsignadas = usuarios.some((u) => mesas[u.id])

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

  const tarjeta = (u: UsuarioView, accent?: string) => (
    <TarjetaUsuario key={u.id} u={u} electores={electores} comunas={comunas}
      mesa={mesas[u.id]} accent={accent} onAlternar={onAlternar} onVincular={onVincular} />
  )

  const grupos = useMemo(() => agruparPorPuesto(usuarios, mesas), [usuarios, mesas])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Acción pegajosa: crear y cambiar de vista sin scrollear los 330. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f8fafc', padding: '0.6rem 0', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
        <button
          onClick={() => setCreando((v) => !v)}
          style={{ background: creando ? '#e2e8f0' : '#0f172a', color: creando ? '#475569' : '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
        >
          {creando ? 'Cerrar' : '+ Nuevo usuario'}
        </button>

        {hayAsignadas && (
          <div style={{ display: 'inline-flex', gap: '0.25rem', fontSize: '0.8rem' }}>
            {(['lista', 'puesto'] as const).map((v) => (
              <button key={v} onClick={() => setVista(v)}
                style={{ padding: '0.35rem 0.8rem', borderRadius: 999, border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 600,
                  background: vista === v ? '#0f172a' : '#f1f5f9', color: vista === v ? '#fff' : '#475569' }}>
                {v === 'lista' ? 'Lista' : 'Por puesto'}
              </button>
            ))}
          </div>
        )}
      </div>

      {creando && (
        <FormNuevoUsuario roles={roles} electores={electores} comunas={comunas} onCancelar={() => setCreando(false)} />
      )}

      {vista === 'lista' || !hayAsignadas ? (
        <div style={grid}>{usuarios.map((u) => tarjeta(u))}</div>
      ) : (
        grupos.map((g, i) => {
          // Color solo a los grupos de puesto (van primero); "sin puesto" y "otras" neutros.
          const color = g.esPuesto ? PALETA[i % PALETA.length] : undefined
          return (
            <section key={g.titulo}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#334155', margin: '0.25rem 0 0.6rem' }}>
                {color && <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />}
                {g.titulo} <span style={{ color: '#94a3b8', fontWeight: 500 }}>· {g.usuarios.length}</span>
              </h3>
              <div style={grid}>{g.usuarios.map((u) => tarjeta(u, color))}</div>
            </section>
          )
        })
      )}
    </div>
  )
}

/** Testigos bajo su puesto (ordenados por mesa), luego los sin puesto, luego el resto. */
function agruparPorPuesto(usuarios: UsuarioView[], mesas: Record<string, MesaDeTestigo>) {
  const porPuesto = new Map<string, UsuarioView[]>()
  const sinPuesto: UsuarioView[] = []
  const otros: UsuarioView[] = []

  for (const u of usuarios) {
    if (u.role !== 'TESTIGO') { otros.push(u); continue }
    const m = mesas[u.id]
    if (!m) { sinPuesto.push(u); continue }
    porPuesto.set(m.puesto, [...(porPuesto.get(m.puesto) ?? []), u])
  }

  const grupos = [...porPuesto.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([puesto, us]) => ({
      titulo: puesto,
      esPuesto: true,
      usuarios: us.sort((a, b) => (mesas[a.id]!.numero - mesas[b.id]!.numero)),
    }))

  if (sinPuesto.length) grupos.push({ titulo: 'Testigos sin puesto asignado', esPuesto: false, usuarios: sinPuesto })
  if (otros.length)     grupos.push({ titulo: 'Otras cuentas (no testigos)', esPuesto: false, usuarios: otros })
  return grupos
}
