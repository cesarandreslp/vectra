'use client'

import { useState, useTransition } from 'react'
import { guardarFactoresPlan, type FactoresPlan } from '../actions-plan'

/** Meta de votos y factores de la cascada. Las tasas se editan en %. */
export function PlanForm({ inicial }: { inicial: FactoresPlan }) {
  const [v, setV] = useState({
    metaVotos:                   inicial.metaVotos?.toString() ?? '',
    tasaFuga:                    String(Math.round(inicial.tasaFuga * 100)),
    tasaConversion:              String(Math.round(inicial.tasaConversion * 100)),
    compromisosPorMultiplicador: String(inicial.compromisosPorMultiplicador),
    multiplicadoresPorLider:     String(inicial.multiplicadoresPorLider),
    nivelLider:                  String(inicial.nivelLider),
  })
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const campo = (key: keyof typeof v, label: string, hint: string) => (
    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151' }}>
      {label}
      <input
        type="number" min={0} value={v[key]}
        onChange={(e) => setV({ ...v, [key]: e.target.value })}
        style={input}
      />
      <span style={hint_}>{hint}</span>
    </label>
  )

  function guardar() {
    setMsg(null)
    startTransition(async () => {
      const res = await guardarFactoresPlan({
        metaVotos:                   v.metaVotos.trim() ? Number(v.metaVotos) : null,
        tasaFuga:                    Number(v.tasaFuga) / 100,
        tasaConversion:              Number(v.tasaConversion) / 100,
        compromisosPorMultiplicador: Number(v.compromisosPorMultiplicador),
        multiplicadoresPorLider:     Number(v.multiplicadoresPorLider),
        nivelLider:                  Number(v.nivelLider),
      })
      setMsg(res.success ? { ok: true, texto: 'Plan guardado.' } : { ok: false, texto: res.error })
    })
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        {campo('metaVotos', 'Meta de votos', 'Votos que necesita la campaña.')}
        {campo('tasaFuga', 'Fuga (%)', 'Compromisos que no llegan a votar.')}
        {campo('tasaConversion', 'Conversión (%)', 'Contactos que terminan en compromiso.')}
        {campo('compromisosPorMultiplicador', 'Compromisos por multiplicador', 'Lo que trae cada multiplicador.')}
        {campo('multiplicadoresPorLider', 'Multiplicadores por líder', 'Cuántos coordina cada líder de zona.')}
        {campo('nivelLider', 'Nivel del líder de zona', 'Profundidad desde el candidato (1 = directos).')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
        <button type="button" onClick={guardar} disabled={pending} style={boton}>
          {pending ? 'Guardando…' : 'Guardar plan'}
        </button>
        {msg && <span style={{ fontSize: '0.8rem', color: msg.ok ? '#15803d' : '#b91c1c' }}>{msg.texto}</span>}
      </div>
    </div>
  )
}

const input: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.55rem 0.75rem',
  border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.875rem', boxSizing: 'border-box',
}
const hint_: React.CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 400, color: '#94a3b8', marginTop: '0.3rem' }
const boton: React.CSSProperties = {
  border: 'none', background: '#1e40af', color: '#fff', padding: '0.6rem 1.25rem',
  borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
}
