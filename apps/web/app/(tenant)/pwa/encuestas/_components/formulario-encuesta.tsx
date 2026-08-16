'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconCheckCircle } from '@/app/_components/icons'
import { getEncuestaPendiente, responderPreguntaApp, type PreguntaPendiente } from '../actions'

export function FormularioEncuesta() {
  const router = useRouter()
  const [preguntas, setPreguntas] = useState<PreguntaPendiente[] | null>(null)

  useEffect(() => {
    void getEncuestaPendiente().then(setPreguntas)
  }, [])

  function onRespondida(id: string) {
    setPreguntas((prev) => (prev ?? []).filter((p) => p.id !== id))
  }

  if (preguntas === null) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>Cargando...</div>
  }

  if (preguntas.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#166534' }}>
        <IconCheckCircle size={40} className="mx-auto" />
        <div style={{ fontWeight: 700, marginTop: '0.75rem' }}>¡Ya respondiste todo!</div>
        <button
          onClick={() => router.push('/pwa')}
          style={{ marginTop: '1rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          Volver
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {preguntas.map((p) => (
        <TarjetaPregunta key={p.id} pregunta={p} onRespondida={onRespondida} />
      ))}
    </div>
  )
}

function TarjetaPregunta({ pregunta, onRespondida }: { pregunta: PreguntaPendiente; onRespondida: (id: string) => void }) {
  const [texto, setTexto] = useState('')
  const [opcionId, setOpcionId] = useState('')
  const [opcionIds, setOpcionIds] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const toggleOpcion = (id: string) =>
    setOpcionIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  async function enviar(respuesta: Parameters<typeof responderPreguntaApp>[1]) {
    setEnviando(true)
    setError('')
    const res = await responderPreguntaApp(pregunta.id, respuesta)
    if (res.success) {
      onRespondida(pregunta.id)
    } else {
      setError(res.error || 'Error al enviar')
      setEnviando(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {pregunta.cargo}
      </div>
      <div style={{ fontWeight: 600, margin: '0.35rem 0 0.75rem' }}>{pregunta.text}</div>

      {pregunta.type === 'FREE_TEXT' && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Tu respuesta..."
            disabled={enviando}
            style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
          />
          <button
            onClick={() => texto.trim() && enviar({ type: 'FREE_TEXT', text: texto })}
            disabled={enviando || !texto.trim()}
            style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 1rem', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            Enviar
          </button>
        </div>
      )}

      {pregunta.type === 'BOOLEAN' && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => enviar({ type: 'BOOLEAN', text: 'SI' })}
            disabled={enviando}
            style={{ flex: 1, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Sí
          </button>
          <button
            onClick={() => enviar({ type: 'BOOLEAN', text: 'NO' })}
            disabled={enviando}
            style={{ flex: 1, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
          >
            No
          </button>
        </div>
      )}

      {pregunta.type === 'SINGLE_CHOICE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {pregunta.opciones.map((o) => (
            <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="radio" name={`opcion-${pregunta.id}`} checked={opcionId === o.id} onChange={() => setOpcionId(o.id)} />
              {o.text}
            </label>
          ))}
          <button
            onClick={() => opcionId && enviar({ type: 'SINGLE_CHOICE', opcionId })}
            disabled={enviando || !opcionId}
            style={{ marginTop: '0.4rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            Enviar
          </button>
        </div>
      )}

      {pregunta.type === 'PARAGRAPH' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <textarea
            value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Tu respuesta..." disabled={enviando} rows={3}
            style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem', resize: 'vertical' }}
          />
          <button onClick={() => texto.trim() && enviar({ type: 'PARAGRAPH', text: texto })} disabled={enviando || !texto.trim()}
            style={{ alignSelf: 'flex-end', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            Enviar
          </button>
        </div>
      )}

      {pregunta.type === 'DROPDOWN' && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select value={opcionId} onChange={(e) => setOpcionId(e.target.value)} disabled={enviando}
            style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
            <option value="">Elige una opción…</option>
            {pregunta.opciones.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
          </select>
          <button onClick={() => opcionId && enviar({ type: 'DROPDOWN', opcionId })} disabled={enviando || !opcionId}
            style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 1rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            Enviar
          </button>
        </div>
      )}

      {pregunta.type === 'MULTIPLE_CHOICE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {pregunta.opciones.map((o) => (
            <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={opcionIds.includes(o.id)} onChange={() => toggleOpcion(o.id)} />
              {o.text}
            </label>
          ))}
          <button onClick={() => opcionIds.length > 0 && enviar({ type: 'MULTIPLE_CHOICE', opcionIds })} disabled={enviando || opcionIds.length === 0}
            style={{ marginTop: '0.4rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            Enviar
          </button>
        </div>
      )}

      {pregunta.type === 'SCALE' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {escala(pregunta.scaleMin, pregunta.scaleMax).map((n) => (
            <button key={n} onClick={() => enviar({ type: 'SCALE', value: n })} disabled={enviando}
              style={{ width: 40, height: 40, borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
              {n}
            </button>
          ))}
        </div>
      )}

      {error && <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.5rem' }}>{error}</div>}
    </div>
  )
}

/** Números min..max de una escala; por defecto 1..5 si no vinieron. */
function escala(min: number | null, max: number | null): number[] {
  const lo = min ?? 1
  const hi = max ?? 5
  if (hi < lo) return [lo]
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}
