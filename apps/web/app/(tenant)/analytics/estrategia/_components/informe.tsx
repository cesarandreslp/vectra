import type { AnalisisView, CorrectivoView } from '../actions'
import { BotonDeshacer } from './boton-deshacer'

const TIPO: Record<string, string> = {
  META_LIDER: 'Meta de líder', META_COMUNA: 'Meta de comuna', REASIGNAR_CONTACTO: 'Reasignar contacto', AVISO: 'Tarea por push',
}
const ESTADO: Record<CorrectivoView['estado'], { label: string; color: string }> = {
  APLICADO:  { label: 'Aplicado',  color: '#166534' },
  PROPUESTO: { label: 'Propuesto', color: '#2563eb' },
  DESHECHO:  { label: 'Deshecho',  color: '#64748b' },
  RECHAZADO: { label: 'Rechazado', color: '#b91c1c' },
}

const th = { textAlign: 'left' as const, fontSize: '0.72rem', color: '#64748b', fontWeight: 600, padding: '0.35rem 0.5rem', borderBottom: '1px solid #e2e8f0' }
const td = { fontSize: '0.82rem', color: '#0f172a', padding: '0.45rem 0.5rem', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' as const }

/** Un análisis semanal: diagnóstico, prioridades y el registro de correctivos. */
export function Informe({ analisis: a }: { analisis: AnalisisView }) {
  const semana = new Date(a.semana).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' })
  const validos    = a.correctivos.filter((c) => c.estado !== 'RECHAZADO')
  const rechazados = a.correctivos.filter((c) => c.estado === 'RECHAZADO')

  return (
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.1rem' }}>
      <h2 style={{ margin: '0 0 0.6rem', fontSize: '1rem', color: '#0f172a' }}>Semana del {semana}</h2>

      {a.estado === 'ERROR' ? (
        <p style={{ fontSize: '0.85rem', color: '#b91c1c', margin: 0 }}>El análisis falló: {a.error}. Se reintenta en la próxima corrida.</p>
      ) : (
        <>
          <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.55, whiteSpace: 'pre-line', margin: '0 0 0.8rem' }}>{a.diagnostico}</p>
          {a.prioridades.length > 0 && (
            <ol style={{ margin: '0 0 1rem', paddingLeft: '1.2rem', fontSize: '0.86rem', color: '#0f172a', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {a.prioridades.map((p, i) => <li key={i}>{p}</li>)}
            </ol>
          )}

          {validos.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>Esta semana no hizo falta corregir nada.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Correctivo</th><th style={th}>Sobre</th><th style={th}>Cambio</th><th style={th}>Por qué</th><th style={th}>Estado</th></tr></thead>
                <tbody>
                  {validos.map((c) => (
                    <tr key={c.id}>
                      <td style={td}>{TIPO[c.tipo] ?? c.tipo}</td>
                      <td style={td}>{c.objetivo}</td>
                      <td style={td}>{c.cambio}</td>
                      <td style={{ ...td, color: '#475569' }}>{c.motivo}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <span style={{ color: ESTADO[c.estado].color, fontWeight: 600 }}>{ESTADO[c.estado].label}</span>
                        {c.deshacible && <BotonDeshacer id={c.id} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rechazados.length > 0 && (
            <details style={{ marginTop: '0.75rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#64748b' }}>
                {rechazados.length} propuesta{rechazados.length === 1 ? '' : 's'} rechazada{rechazados.length === 1 ? '' : 's'} por los topes
              </summary>
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#475569' }}>
                {rechazados.map((c) => <li key={c.id}>{TIPO[c.tipo] ?? c.tipo} sobre {c.objetivo}: {c.motivoRechazo}</li>)}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  )
}
