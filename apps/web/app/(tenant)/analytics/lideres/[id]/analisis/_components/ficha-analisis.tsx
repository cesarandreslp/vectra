'use client'

import { useState, useTransition } from 'react'
import { generarAnalisisLider } from '../../../../actions'
import type { LeaderAnalysisResult } from '../../../../actions'
import { ChartRadar } from './chart-radar'

const COLORES_VEREDICTO: Record<string, { bg: string; text: string; border: string }> = {
  FIDELIZAR:  { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  MONITOREAR: { bg: '#fef9c3', text: '#854d0e', border: '#f59e0b' },
  PRESCINDIR: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
}

const COLORES_PESO: Record<string, { bg: string; text: string }> = {
  ALTO:  { bg: '#fee2e2', text: '#991b1b' },
  MEDIO: { bg: '#fef9c3', text: '#854d0e' },
  BAJO:  { bg: '#e0f2fe', text: '#0c4a6e' },
}

/** Ficha completa de análisis IA de un líder */
export function FichaAnalisis({
  leaderId,
  initial,
}: {
  leaderId: string
  initial:  LeaderAnalysisResult | null
}) {
  const [analisis, setAnalisis]    = useState(initial)
  const [error, setError]          = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerar() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await generarAnalisisLider(leaderId)
        setAnalisis(result)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al generar análisis')
      }
    })
  }

  // Estado: sin análisis — mostrar botón
  if (!analisis) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem' }}>
        {isPending ? (
          <>
            <div style={{ fontSize: '2rem' }}>Analizando...</div>
            <p style={{ color: '#64748b' }}>El agente IA está evaluando el perfil de fidelidad del líder.</p>
          </>
        ) : (
          <>
            <p style={{ color: '#64748b' }}>No hay análisis disponible para este líder.</p>
            <button onClick={handleGenerar} style={{
              padding: '0.75rem 1.5rem', fontSize: '1rem', borderRadius: '8px',
              border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer',
              fontWeight: 600,
            }}>
              Generar análisis
            </button>
          </>
        )}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      </div>
    )
  }

  const vColor = COLORES_VEREDICTO[analisis.veredicto] ?? COLORES_VEREDICTO.MONITOREAR
  const esAntiguo = (Date.now() - new Date(analisis.generadoEn).getTime()) > 24 * 60 * 60 * 1000

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Encabezado con veredicto */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: vColor.bg, border: `2px solid ${vColor.border}`, borderRadius: '12px',
        padding: '1.25rem',
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: vColor.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Veredicto
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: vColor.text }}>
            {analisis.veredicto}
          </div>
          <div style={{ fontSize: '0.875rem', color: vColor.text, opacity: 0.8, marginTop: '0.25rem' }}>
            Perfil: {analisis.perfilTipo}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Fidelidad</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{analisis.indiceFidelidad}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Riesgo</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{analisis.indiceRiesgo}</div>
          </div>
        </div>
      </div>

      {/* Radar + señales lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <ChartRadar dimensiones={analisis.radarDimensiones} />

        {/* Señales detectadas */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#334155' }}>
            Señales detectadas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {analisis.senalesDetectadas.map((s, i) => {
              const pesoColor = COLORES_PESO[s.peso] ?? COLORES_PESO.BAJO
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.5rem', borderRadius: '6px', background: '#f8fafc' }}>
                  <span style={{ fontSize: '0.875rem', color: '#334155' }}>{s.señal}</span>
                  <span style={{
                    padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem',
                    fontWeight: 600, background: pesoColor.bg, color: pesoColor.text,
                  }}>
                    {s.peso}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Plan de acción */}
      {analisis.planAccion && analisis.planAccion.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#334155' }}>
            Plan de acción
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(analisis.planAccion.length, 3)}, 1fr)`, gap: '1rem' }}>
            {analisis.planAccion.map((p, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: '12px', padding: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '4px solid #3b82f6',
              }}>
                <div style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Paso {i + 1}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#0f172a', fontWeight: 500 }}>{p.accion}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                  Tiempo: {p.tiempo}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Responsable: {p.responsable}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Justificación */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#334155' }}>
          Justificación del agente
        </h3>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: 1.6 }}>
          {analisis.justificacion}
        </p>
      </div>

      {/* Metadata + regenerar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Generado: {new Date(analisis.generadoEn).toLocaleString('es-CO')}
        </span>
        {esAntiguo && (
          <button onClick={handleGenerar} disabled={isPending} style={{
            padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '6px',
            border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer',
          }}>
            {isPending ? 'Regenerando...' : 'Regenerar análisis'}
          </button>
        )}
      </div>

      {error && <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>}
    </div>
  )
}
