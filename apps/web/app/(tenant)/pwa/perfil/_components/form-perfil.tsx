'use client'

import { useId, useState } from 'react'
import { guardarMiPerfil, type MiPerfil, type Vocabulario } from '../actions'
import {
  DIAS, FRANJAS, slot, ETIQUETA_DIA, ETIQUETA_FRANJA, VEHICULOS,
  type Vehiculo,
} from '@/lib/perfil'
import { SelectorEtiquetas } from './selector-etiquetas'
import { BloqueEstudios } from './bloque-estudios'

const input = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 0.6rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' as const }
const lbl = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }

export function FormPerfil({ inicial, vocabulario }: { inicial: MiPerfil; vocabulario: Vocabulario }) {
  const [p, setP] = useState(inicial)
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk] = useState(false)
  const listaOficios = useId()

  const set = <K extends keyof MiPerfil>(k: K, v: MiPerfil[K]) => { setP((prev) => ({ ...prev, [k]: v })); setOk(false) }

  const alternarSlot = (token: string) => {
    set('disponibilidad', p.disponibilidad.includes(token)
      ? p.disponibilidad.filter((s) => s !== token)
      : [...p.disponibilidad, token])
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const r = await guardarMiPerfil(p)
    setGuardando(false)
    if (!r.success) { alert(r.error); return }
    setOk(true)
  }

  return (
    <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      <div>
        <label style={lbl}>¿A qué te dedicás?</label>
        {/* Desplegable que además deja escribir: si el oficio no está en la
            lista, lo que digite queda de opción para el que llene después. */}
        <input
          list={listaOficios} value={p.oficio ?? ''}
          onChange={(e) => set('oficio', e.target.value)}
          placeholder="Elegí de la lista o escribí el tuyo" style={input}
        />
        <datalist id={listaOficios}>
          {vocabulario.oficios.map((o) => <option key={o} value={o} />)}
        </datalist>
      </div>

      <div>
        <label style={lbl}>¿Qué sabés hacer?</label>
        <SelectorEtiquetas
          valor={p.habilidades} opciones={vocabulario.habilidades}
          onChange={(v) => set('habilidades', v)} placeholder="Ej: conducir"
        />
      </div>

      <div>
        <label style={lbl}>¿Qué podés poner vos?</label>
        <SelectorEtiquetas
          valor={p.herramientas} opciones={vocabulario.herramientas}
          onChange={(v) => set('herramientas', v)} placeholder="Ej: carpa"
        />
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

      <div>
        <label style={lbl}>¿Tenés vehículo?</label>
        <select value={p.vehiculo} onChange={(e) => set('vehiculo', e.target.value as Vehiculo)} style={input}>
          {VEHICULOS.map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}
        </select>
      </div>

      <BloqueEstudios
        nivel={p.nivelEducativo} tituloEn={p.tituloEn}
        posgrado={p.posgrado} posgradoEn={p.posgradoEn}
        certificaciones={p.certificaciones}
        titulos={vocabulario.titulos} opcionesCertificaciones={vocabulario.certificaciones}
        onChange={(campo, valor) => set(campo, valor as MiPerfil[typeof campo])}
      />

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
