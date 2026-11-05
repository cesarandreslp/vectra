'use client'

import { useState, useTransition } from 'react'
import { guardarConfigDatos, type ConfigDatos } from '../actions-datos'

/** Texto de autorización (Ley 1581) que ve quien se registra, y a dónde escribir para ejercer sus derechos. */
export function DatosPanel({ inicial }: { inicial: ConfigDatos }) {
  const [texto, setTexto] = useState(inicial.texto)
  const [contacto, setContacto] = useState(inicial.contacto)
  const [mensaje, setMensaje] = useState('')
  const [pendiente, iniciar] = useTransition()

  const guardar = () => iniciar(async () => {
    const r = await guardarConfigDatos(texto, contacto)
    setMensaje(r.success ? 'Guardado. Desde ya es el texto que ven quienes se registran.' : r.error)
  })

  const caja: React.CSSProperties = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.85rem', boxSizing: 'border-box' }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {inicial.sinAutorizacion > 0 && (
        <div style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.8rem' }}>
          {inicial.sinAutorizacion} elector(es) sin autorización registrada. Se les pide al entrar a la app.
        </div>
      )}
      <label style={{ fontSize: '0.8rem', color: '#334155' }}>
        <b>Correo o teléfono para ejercer derechos</b> (consultar, corregir, suprimir datos o revocar la autorización)
        <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="datos@campana.co" style={{ ...caja, marginTop: 4 }} />
      </label>
      <label style={{ fontSize: '0.8rem', color: '#334155' }}>
        <b>Texto de autorización</b> — vacío usa el sugerido. La campaña es la responsable del tratamiento: que lo revise su asesor legal.
        <textarea rows={7} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={inicial.sugerido} style={{ ...caja, marginTop: 4 }} />
      </label>
      {!texto.trim() && (
        <button type="button" onClick={() => setTexto(inicial.sugerido)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#1e40af', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>
          Partir del texto sugerido para editarlo
        </button>
      )}
      <button
        type="button" onClick={guardar} disabled={pendiente}
        style={{ alignSelf: 'flex-start', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', opacity: pendiente ? 0.6 : 1 }}
      >
        {pendiente ? 'Guardando…' : 'Guardar'}
      </button>
      {mensaje && <p style={{ margin: 0, fontSize: '0.8rem', color: '#334155' }}>{mensaje}</p>}
    </div>
  )
}
