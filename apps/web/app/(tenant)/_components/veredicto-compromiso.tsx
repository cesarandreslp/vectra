'use client'

import { useEffect, useState, useTransition } from 'react'
import { generarAnalisisCompromiso, getAnalisisCompromisoCacheado } from '@/app/(tenant)/core/actions'
import type { CompromisoAnalysisResult } from '@/app/(tenant)/core/actions'

const COLORES_VEREDICTO: Record<string, { bg: string; text: string; border: string }> = {
  COMPROMETIDO:   { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  EN_SEGUIMIENTO: { bg: '#fef9c3', text: '#854d0e', border: '#f59e0b' },
  EN_RIESGO:      { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
}

const COLORES_PESO: Record<string, { bg: string; text: string }> = {
  ALTO:  { bg: '#fee2e2', text: '#991b1b' },
  MEDIO: { bg: '#fef9c3', text: '#854d0e' },
  BAJO:  { bg: '#e0f2fe', text: '#0c4a6e' },
}

/**
 * Ficha de veredicto IA de compromiso — mismo patrón que
 * analytics/lideres/[id]/analisis. Vive en el _components compartido del
 * tenant porque la usan tanto la ficha de elector de la PWA como la del
 * panel admin (/core/electores/[id]).
 */
export function VeredictoCompromiso({ voterId }: { voterId: string }) {
  const [analisis, setAnalisis] = useState<CompromisoAnalysisResult | null>(null)
  const [cargandoCache, setCargandoCache] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    void getAnalisisCompromisoCacheado(voterId).then((r) => {
      setAnalisis(r)
      setCargandoCache(false)
    })
  }, [voterId])

  function generar() {
    setError(null)
    startTransition(async () => {
      const r = await generarAnalisisCompromiso(voterId)
      if (r.ok) setAnalisis(r.analisis)
      else setError(r.error)
    })
  }

  if (!analisis) {
    if (cargandoCache) return null

    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
        {isPending ? (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>El agente IA está evaluando su compromiso...</p>
        ) : (
          <>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>Sin veredicto IA todavía.</p>
            <button
              onClick={generar}
              style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Generar veredicto de compromiso
            </button>
          </>
        )}
        {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>}
      </div>
    )
  }

  const vColor = COLORES_VEREDICTO[analisis.veredicto] ?? COLORES_VEREDICTO.EN_SEGUIMIENTO
  const esAntiguo = (Date.now() - new Date(analisis.generadoEn).getTime()) > 24 * 60 * 60 * 1000

  return (
    <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ background: vColor.bg, border: `2px solid ${vColor.border}`, borderRadius: '12px', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: vColor.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Veredicto IA</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: vColor.text }}>{analisis.veredicto.replace('_', ' ')}</div>
            <div style={{ fontSize: '0.8rem', color: vColor.text, opacity: 0.8, marginTop: '0.15rem' }}>Perfil: {analisis.perfilTipo}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Índice</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>{analisis.indiceCompromiso}</div>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Señales detectadas</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {analisis.senalesDetectadas.map((s, i) => {
            const c = COLORES_PESO[s.peso] ?? COLORES_PESO.BAJO
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.5rem', borderRadius: '6px', background: '#f8fafc' }}>
                <span style={{ fontSize: '0.8rem', color: '#334155' }}>{s.señal}</span>
                <span style={{ padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 600, background: c.bg, color: c.text }}>{s.peso}</span>
              </div>
            )
          })}
        </div>
      </div>

      {analisis.planAccion && analisis.planAccion.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Plan de acción</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {analisis.planAccion.map((p, i) => (
              <div key={i} style={{ borderLeft: '3px solid #3b82f6', paddingLeft: '0.6rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 500 }}>{p.accion}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.tiempo} · {p.responsable}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>Justificación</div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>{analisis.justificacion}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
          Generado: {new Date(analisis.generadoEn).toLocaleString('es-CO')}
        </span>
        {esAntiguo && (
          <button onClick={generar} disabled={isPending} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
            {isPending ? 'Regenerando...' : 'Regenerar'}
          </button>
        )}
      </div>
      {error && <p style={{ color: '#ef4444', fontSize: '0.8rem' }}>{error}</p>}
    </div>
  )
}
