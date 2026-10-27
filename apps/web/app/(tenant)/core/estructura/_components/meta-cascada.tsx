import type { PlanView } from '../actions-plan'
import type { Niveles } from '../_lib/cascada'
import { Bloque } from './estructura-panel'

export const NIVELES: { key: keyof Niveles; label: string }[] = [
  { key: 'contactos',       label: 'Contactos' },
  { key: 'compromisos',     label: 'Compromisos' },
  { key: 'multiplicadores', label: 'Multiplicadores' },
  { key: 'lideres',         label: 'Líderes de zona' },
]

export const fmt = (n: number) => n.toLocaleString('es-CO')

/** Meta en cascada: lo que la meta exige por nivel contra lo que hay en la red. */
export function MetaCascada({ plan }: { plan: PlanView }) {
  const { metaVotos, necesario, real, lideres, factores } = plan

  return (
    <Bloque titulo="Meta en cascada" editar="/core/configuracion">
      {!necesario || !metaVotos ? (
        <p style={nota}>Sin meta de votos configurada. Defínela en Configuración para ver lo que exige a la red.</p>
      ) : (
        <>
          <p style={nota}>
            Meta {fmt(metaVotos)} votos · fuga {Math.round(factores.tasaFuga * 100)} % · conversión{' '}
            {Math.round(factores.tasaConversion * 100)} % · {factores.compromisosPorMultiplicador} compromisos por
            multiplicador · {factores.multiplicadoresPorLider} multiplicadores por líder (nivel {factores.nivelLider}).
          </p>
          <table style={tabla}>
            <thead>
              <tr><th style={th}>Nivel</th><th style={thN}>Necesario</th><th style={thN}>Real</th><th style={thN}>Faltante</th></tr>
            </thead>
            <tbody>
              {NIVELES.map(({ key, label }) => {
                const falta = Math.max(0, necesario[key] - real[key])
                return (
                  <tr key={key}>
                    <td style={td}>{label}</td>
                    <td style={tdN}>{fmt(necesario[key])}</td>
                    <td style={tdN}>{fmt(real[key])}</td>
                    <td style={{ ...tdN, color: falta ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                      {falta ? `⚠ ${fmt(falta)}` : '✓'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      <p style={{ ...nota, margin: '1rem 0 0.5rem', fontWeight: 600, color: '#0f172a' }}>Por líder</p>
      {lideres.length === 0 ? (
        <p style={nota}>Aún no hay líderes con red en el nivel {factores.nivelLider}.</p>
      ) : (
        <table style={tabla}>
          <thead>
            <tr><th style={th}>Líder</th><th style={thN}>Multiplicadores</th><th style={thN}>Compromisos</th><th style={thN}>Esperados</th><th style={thN}>Faltante</th></tr>
          </thead>
          <tbody>
            {lideres.map((l) => {
              const falta = Math.max(0, l.esperado - l.compromisos)
              return (
                <tr key={l.id}>
                  <td style={td}>{l.nombre}</td>
                  <td style={tdN}>{fmt(l.multiplicadores)}</td>
                  <td style={tdN}>{fmt(l.compromisos)}</td>
                  <td style={tdN}>{fmt(l.esperado)}</td>
                  <td style={{ ...tdN, color: falta ? '#b91c1c' : '#15803d' }}>{falta ? fmt(falta) : '✓'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Bloque>
  )
}

export const nota: React.CSSProperties  = { margin: '0 0 0.75rem', fontSize: '0.78rem', color: '#64748b' }
export const tabla: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }
export const th: React.CSSProperties    = { textAlign: 'left', fontWeight: 500, color: '#64748b', fontSize: '0.75rem', padding: '0.35rem 0.5rem', borderBottom: '1px solid #e2e8f0' }
export const thN: React.CSSProperties   = { ...th, textAlign: 'right' }
export const td: React.CSSProperties    = { padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', color: '#0f172a' }
export const tdN: React.CSSProperties   = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
