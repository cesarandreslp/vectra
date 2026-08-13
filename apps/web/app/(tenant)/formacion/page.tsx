import { listMaterials, listMaterialsAdmin, createMaterial, toggleMaterial, deleteMaterial, toggleGlobalMaterialVisibility } from './actions'
import { MaterialCard } from './_components/material-card'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'

const TIPOS = ['SLIDES', 'PDF', 'VIDEO', 'INFOGRAFIA'] as const

export default async function FormacionMaterialesPage() {
  const session   = await requireModuleOrRedirect('FORMACION')
  const isAdmin   = session.user.role === 'ADMIN_CAMPANA'
  const materiales = await listMaterials()

  // Admin ve también sus materiales propios (incluye inactivos)
  const materialesAdmin = isAdmin ? await listMaterialsAdmin() : []

  async function handleCreate(formData: FormData) {
    'use server'
    await createMaterial(formData)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
        Materiales de formación
      </h1>

      {/* Grid de materiales visibles */}
      {materiales.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}>
          {materiales.map(m => (
            <MaterialCard key={`${m.source}-${m.id}`} material={m} />
          ))}
        </div>
      ) : (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '3rem',
          textAlign: 'center', color: '#94a3b8',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          No hay materiales disponibles
        </div>
      )}

      {/* Sección admin: gestión de materiales propios */}
      {isAdmin && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#334155' }}>
            Gestionar materiales propios
          </h2>

          {/* Formulario de subida */}
          <form
            action={handleCreate}
            style={{
              background: '#fff', borderRadius: '12px', padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>Nuevo material</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="title" style={labelStyle}>Título</label>
                <input id="title" name="title" required style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="type" style={labelStyle}>Tipo</label>
                <select id="type" name="type" required style={inputStyle}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="description" style={labelStyle}>Descripción (opcional)</label>
              <input id="description" name="description" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="file" style={labelStyle}>Archivo</label>
                <input id="file" name="file" type="file" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="externalUrl" style={labelStyle}>O URL externa</label>
                <input id="externalUrl" name="externalUrl" type="url" placeholder="https://..." style={inputStyle} />
              </div>
            </div>

            <button type="submit" style={{
              padding: '0.75rem', fontSize: '0.875rem', borderRadius: '6px',
              border: 'none', background: '#1e40af', color: '#fff', cursor: 'pointer',
              fontWeight: 600, alignSelf: 'flex-start',
            }}>
              Subir material
            </button>
          </form>

          {/* Tabla de materiales propios del tenant */}
          {materialesAdmin.length > 0 && (
            <div style={{
              background: '#fff', borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflowX: 'auto',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Título', 'Tipo', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={headerStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materialesAdmin.map(m => (
                    <AdminMaterialRow key={m.id} material={m} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function AdminMaterialRow({ material: m }: { material: { id: string; title: string; type: string; isActive: boolean } }) {
  async function handleToggle() {
    'use server'
    await toggleMaterial(m.id)
  }

  async function handleDelete() {
    'use server'
    await deleteMaterial(m.id)
  }

  return (
    <tr>
      <td style={cellStyle}>{m.title}</td>
      <td style={cellStyle}>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.type}</span>
      </td>
      <td style={cellStyle}>
        <form action={handleToggle} style={{ display: 'inline' }}>
          <button type="submit" style={{
            padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px',
            border: `1px solid ${m.isActive ? '#22c55e' : '#ef4444'}`,
            background: m.isActive ? '#dcfce7' : '#fee2e2',
            color: m.isActive ? '#166534' : '#991b1b',
            cursor: 'pointer',
          }}>
            {m.isActive ? 'Activo' : 'Inactivo'}
          </button>
        </form>
      </td>
      <td style={cellStyle}>
        <form action={handleDelete} style={{ display: 'inline' }}>
          <button type="submit" style={{
            padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px',
            border: '1px solid #fecaca', background: '#fff', color: '#ef4444', cursor: 'pointer',
          }}>
            Eliminar
          </button>
        </form>
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
const headerStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
}
const cellStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', fontSize: '0.875rem', borderBottom: '1px solid #f1f5f9',
}
