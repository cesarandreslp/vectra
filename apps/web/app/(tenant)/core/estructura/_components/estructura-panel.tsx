import Link from 'next/link'
import type { EstructuraView } from '../actions'

/** Vista compuesta de solo lectura: cada bloque enlaza a donde se edita. */
export function EstructuraPanel({ data }: { data: EstructuraView }) {
  const { candidato, tesorero, sede, territorio, staff } = data
  const total     = territorio.comunas + territorio.barrios
  const conLider  = territorio.comunasConLider + territorio.barriosConLider
  const cobertura = total ? Math.round((conLider / total) * 100) : 0
  const huecos    = total - conLider

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      <Bloque titulo="Cabeza" editar="/core/configuracion">
        <div style={grid}>
          <Persona nombre={candidato.nombre} sub={candidato.cargo ? `Candidato · ${candidato.cargo}` : 'Candidato · cargo sin definir'} />
          {tesorero && (
            <Persona
              nombre={tesorero.nombre ?? 'Sin asignar'}
              sub="Tesorero"
              alerta={!tesorero.nombre}
              editar="/finanzas/configuracion"
            />
          )}
        </div>
      </Bloque>

      <Bloque titulo="Sede" editar="/core/configuracion">
        {sede.nombre || sede.direccion || sede.lider ? (
          <Persona
            nombre={[sede.nombre, sede.direccion].filter(Boolean).join(' · ') || 'Sede'}
            sub={sede.lider ? `Líder de sede: ${sede.lider}` : 'Sin líder de sede'}
          />
        ) : (
          <p style={vacio}>Sede sin registrar.</p>
        )}
      </Bloque>

      <Bloque titulo="Cadena territorial" editar="/core/lideres">
        <div style={{ ...grid, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
          <Tile label="Comunas"   valor={`${territorio.comunasConLider}`} sufijo={`/ ${territorio.comunas} con líder`} />
          <Tile label="Barrios"   valor={`${territorio.barriosConLider}`} sufijo={`/ ${territorio.barrios} con líder`} />
          <Tile label="Cobertura" valor={`${cobertura}%`} />
          <Tile label="Huecos"    valor={`${huecos}`} alerta={huecos > 0} />
        </div>
      </Bloque>

      <Bloque titulo="Staff con acceso al panel" editar="/core/configuracion">
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: '#64748b' }}>
          Quién entra al panel y con qué alcance. No es la cadena territorial: un líder de
          zona no necesita cuenta.
        </p>
        {staff.length === 0 ? (
          <p style={vacio}>Sin usuarios de staff.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {staff.map((s, i) => (
              <div key={s.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderTop: i ? '1px solid #f1f5f9' : 'none' }}>
                <span style={{ fontSize: '0.875rem', color: s.activo ? '#0f172a' : '#94a3b8' }}>
                  {s.nombre ? `${s.nombre} · ${s.email}` : s.email}{!s.activo && ' (inactivo)'}
                </span>
                <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', padding: '0.15rem 0.6rem', borderRadius: 6, whiteSpace: 'nowrap' }}>{s.rol}</span>
              </div>
            ))}
          </div>
        )}
      </Bloque>
    </div>
  )
}

function Bloque({ titulo, editar, children }: { titulo: string; editar: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{titulo}</span>
        <Link href={editar} style={{ fontSize: '0.75rem', color: '#1e40af', whiteSpace: 'nowrap' }}>editar en {editar} →</Link>
      </div>
      {children}
    </div>
  )
}

function Persona({ nombre, sub, alerta, editar }: { nombre: string; sub: string; alerta?: boolean; editar?: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem', color: '#0f172a' }}>{nombre}</p>
      <p style={{ margin: 0, fontSize: '0.78rem', color: alerta ? '#b45309' : '#64748b' }}>
        {sub}{alerta && ' · pieza suelta'}
        {editar && <> · <Link href={editar} style={{ color: '#1e40af' }}>editar</Link></>}
      </p>
    </div>
  )
}

function Tile({ label, valor, sufijo, alerta }: { label: string; valor: string; sufijo?: string; alerta?: boolean }) {
  return (
    <div style={{ background: alerta ? '#fffbeb' : '#f8fafc', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
      <p style={{ margin: 0, fontSize: '0.75rem', color: alerta ? '#b45309' : '#64748b' }}>{label}</p>
      <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: 600, color: alerta ? '#b45309' : '#0f172a' }}>
        {valor}{sufijo && <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#94a3b8' }}> {sufijo}</span>}
      </p>
    </div>
  )
}

const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }
const vacio: React.CSSProperties = { margin: 0, fontSize: '0.85rem', color: '#94a3b8' }
