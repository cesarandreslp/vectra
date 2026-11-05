'use client'

import { useState, useTransition } from 'react'
import { enviarSolicitud } from '../actions'
import { TIPOS_SOLICITUD } from '@/lib/politica-datos'

export function FormularioSolicitud({ slug }: { slug: string }) {
  const [f, setF] = useState({ tipo: '', cedula: '', nombre: '', contacto: '', detalle: '' })
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, iniciar] = useTransition()
  const campo = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }))

  if (resultado?.ok) {
    return <div style={{ background: '#dcfce7', color: '#166534', borderRadius: 8, padding: '1rem', fontSize: '0.9rem' }}>{resultado.texto}</div>
  }

  const caja: React.CSSProperties = { width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', boxSizing: 'border-box' }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        iniciar(async () => {
          const r = await enviarSolicitud(slug, f)
          setResultado(r.success
            ? { ok: true, texto: `Recibimos tu solicitud. La campaña tiene plazo hasta el ${r.vence} para responderte por el medio que dejaste.` }
            : { ok: false, texto: r.error })
        })
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    >
      <select value={f.tipo} onChange={campo('tipo')} required style={caja}>
        <option value="">¿Qué quieres hacer?</option>
        {Object.entries(TIPOS_SOLICITUD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input value={f.nombre} onChange={campo('nombre')} placeholder="Nombre completo" required style={caja} />
      <input value={f.cedula} onChange={campo('cedula')} placeholder="Número de cédula" inputMode="numeric" required style={caja} />
      <input value={f.contacto} onChange={campo('contacto')} placeholder="Correo o celular para responderte" required style={caja} />
      <textarea value={f.detalle} onChange={campo('detalle')} placeholder="Detalle (opcional): qué dato corregir, por ejemplo" rows={3} style={caja} />
      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
        Antes de borrar o corregir datos, la campaña confirmará que eres el titular por el medio que dejes.
      </p>
      {resultado && !resultado.ok && <div style={{ color: '#991b1b', fontSize: '0.85rem' }}>{resultado.texto}</div>}
      <button type="submit" disabled={pendiente} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '0.8rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', opacity: pendiente ? 0.6 : 1 }}>
        {pendiente ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  )
}
