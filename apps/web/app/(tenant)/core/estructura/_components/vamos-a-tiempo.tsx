import type { PlanView } from '../actions-plan'
import { estadoNivel, type Estado } from '../_lib/cascada'
import { Bloque } from './estructura-panel'
import { NIVELES, fmt, nota, tabla, th, thN, td, tdN } from './meta-cascada'

const COLOR: Record<Estado, string> = { adelantado: '#15803d', 'a tiempo': '#1e40af', atrasado: '#b91c1c' }
const DIA = 86_400_000

/** ¿Vamos a tiempo?: la red real contra lo esperado a hoy según los hitos. */
export function VamosATiempo({ plan }: { plan: PlanView }) {
  const { proximo, esperado, real, hitos } = plan

  return (
    <Bloque titulo="¿Vamos a tiempo?" editar="/core/configuracion">
      {!esperado ? (
        <p style={nota}>Sin hitos definidos. Agrégalos en Configuración con la fecha y lo que la red debe tener para entonces.</p>
      ) : (
        <>
          <p style={nota}>
            {proximo ? (
              <>
                Próximo hito: <strong style={{ color: '#0f172a' }}>{proximo.fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong>
                {' '}· faltan {Math.max(0, Math.ceil((proximo.fecha.getTime() - Date.now()) / DIA))} días
                {proximo.nota ? ` · ${proximo.nota}` : ''}
              </>
            ) : (
              <>Ya pasaron los {hitos} hitos: se compara contra el último.</>
            )}
          </p>
          <table style={tabla}>
            <thead>
              <tr>
                <th style={th}>Nivel</th><th style={thN}>Real</th><th style={thN}>Esperado hoy</th>
                {proximo && <th style={thN}>Falta para el hito</th>}
                <th style={thN}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {NIVELES.map(({ key, label }) => {
                const estado = estadoNivel(real[key], esperado[key])
                return (
                  <tr key={key}>
                    <td style={td}>{label}</td>
                    <td style={tdN}>{fmt(real[key])}</td>
                    <td style={tdN}>{fmt(esperado[key])}</td>
                    {proximo && <td style={tdN}>{fmt(Math.max(0, proximo[key] - real[key]))}</td>}
                    <td style={{ ...tdN, color: COLOR[estado], fontWeight: 600 }}>{estado}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </Bloque>
  )
}
