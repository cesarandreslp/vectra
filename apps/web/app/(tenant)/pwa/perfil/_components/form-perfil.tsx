'use client'

import { useState } from 'react'
import { guardarMiPerfil, type MiPerfil } from '../actions'
import {
  DIAS, FRANJAS, slot, ETIQUETA_DIA, ETIQUETA_FRANJA, VEHICULOS, NIVELES, aEtiquetas,
  type Vehiculo, type Nivel,
} from '@/lib/perfil'

const input = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 0.6rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' as const }
const lbl = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }

export function FormPerfil({ inicial }: { inicial: MiPerfil }) {
  const [p, setP] = useState(inicial)
  const [habilidadesTexto, setHabilidades] = useState(inicial.habilidades.join(', '))
  const [herramientasTexto, setHerramientas] = useState(inicial.herramientas.join(', '))
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk] = useState(false)

  const set = <K extends keyof MiPerfil>(k: K, v: MiPerfil[K]) => { setP((prev) => ({ ...prev, [k]: v })); setOk(false) }

  const alternarSlot = (token: string) => {
    set('disponibilidad', p.disponibilidad.includes(token)
      ? p.disponibilidad.filter((s) => s !== token)
      : [...p.disponibilidad, token])
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const r = await guardarMiPerfil({
      ...p,
      habilidades:  aEtiquetas(habilidadesTexto),
      herramientas: aEtiquetas(herramientasTexto),
    })
    setGuardando(false)
    if (!r.success) { alert(r.error); return }
    setOk(true)
  }

  return (
    <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div>
        <label style={lbl}>¿A qué te dedicás?</label>
        <input value={p.oficio ?? ''} onChange={(e) => set('oficio', e.target.value)} placeholder="Ej: electricista, docente, comerciante" style={input} />
      </div>

      <div>
        <label style={lbl}>¿Qué sabés hacer? (separá con comas)</label>
        <input value={habilidadesTexto} onChange={(e) => { setHabilidades(e.target.value); setOk(false) }} placeholder="conducir, cocinar, primeros auxilios, sonido" style={input} />
      </div>

      <div>
        <label style={lbl}>¿Qué podés poner vos? (separá con comas)</label>
        <input value={herramientasTexto} onChange={(e) => { setHerramientas(e.target.value); setOk(false) }} placeholder="carpa, megáfono, olla comunitaria, herramienta" style={input} />
      </div>

      <div>
        <label style={lbl}>¿Cuándo podés?</label>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.72rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '0.3rem' }} />
                {DIAS.map((d) => <th key={d} style={{ padding: '0.3rem', color: '#64748b', fontWeight: 600 }}>{ETIQUETA_DIA[d]}</th>)}
              </tr>
            </thead>
            <tbody>
              {FRANJAS.map((f) => (
                <tr key={f}>
                  <td style={{ padding: '0.3rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{ETIQUETA_FRANJA[f]}</td>
                  {DIAS.map((d) => {
                    const token = slot(d, f)
                    const activo = p.disponibilidad.includes(token)
                    return (
                      <td key={d} style={{ textAlign: 'center', padding: '0.15rem' }}>
                        <button type="button" onClick={() => alternarSlot(token)} aria-pressed={activo} aria-label={`${ETIQUETA_DIA[d]} ${ETIQUETA_FRANJA[f]}`}
                          style={{ width: '1.6rem', height: '1.6rem', borderRadius: '5px', cursor: 'pointer', border: `1px solid ${activo ? '#16a34a' : '#cbd5e1'}`, background: activo ? '#16a34a' : '#fff', color: '#fff' }}>
                          {activo ? '✓' : ''}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>¿Tenés vehículo?</label>
          <select value={p.vehiculo} onChange={(e) => set('vehiculo', e.target.value as Vehiculo)} style={input}>
            {VEHICULOS.map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Estudios</label>
          <select value={p.nivelEducativo ?? ''} onChange={(e) => set('nivelEducativo', (e.target.value || null) as Nivel | null)} style={input}>
            <option value="">sin especificar</option>
            {NIVELES.map((n) => <option key={n} value={n}>{n.toLowerCase()}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={lbl}>Experiencia previa</label>
        <input value={p.experiencia ?? ''} onChange={(e) => set('experiencia', e.target.value)} placeholder="Ej: testigo electoral 2022, brigadas de salud" style={input} />
      </div>

      <div>
        <label style={lbl}>¿En qué barrio o zona te movés?</label>
        <input value={p.zonaAccion ?? ''} onChange={(e) => set('zonaAccion', e.target.value)} placeholder="Ej: Comuna 3, barrio El Progreso" style={input} />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#475569' }}>
        <input type="checkbox" checked={p.aceptaWhatsapp} onChange={(e) => set('aceptaWhatsapp', e.target.checked)} />
        Acepto que me contacten por WhatsApp
      </label>

      <div>
        <label style={lbl}>Algo más que quieras contar</label>
        <textarea value={p.nota ?? ''} onChange={(e) => set('nota', e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
      </div>

      <button type="submit" disabled={guardando} style={{ background: guardando ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.7rem', fontSize: '0.9rem', fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer' }}>
        {guardando ? 'Guardando…' : 'Guardar mi perfil'}
      </button>
      {ok && <div style={{ background: '#dcfce7', color: '#166534', borderRadius: '6px', padding: '0.5rem 0.7rem', fontSize: '0.82rem' }}>Listo, quedó guardado.</div>}
    </form>
  )
}
