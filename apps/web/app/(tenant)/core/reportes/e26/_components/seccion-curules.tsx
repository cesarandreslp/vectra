import type { DatosE26 } from '../../actions'
import { asignarCurules } from '@/lib/cifra-repartidora'
import { tabla, celda, subtitulo, nota } from './estilos'

const fmt = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 })

/** Umbral, cifra repartidora y curules por agrupación, como en la declaratoria de elección. */
export function SeccionCurules({ agrupaciones, blanco, curules }: {
  agrupaciones: DatosE26['agrupaciones']; blanco: number; curules: number
}) {
  const r = asignarCurules(agrupaciones.map((g) => ({ nombre: g.nombre, votos: g.total })), blanco, curules)

  return (
    <>
      <h3 style={subtitulo}>Asignación de curules ({curules})</h3>
      <table style={tabla}>
        <tbody>
          {[
            ['Votos válidos', fmt(r.votosValidos)],
            ['Cociente electoral (válidos ÷ curules)', fmt(r.cociente)],
            [`Umbral (${curules <= 2 ? '30' : '50'} % del cociente)`, fmt(r.umbral)],
            ['Cifra repartidora', r.cifraRepartidora ? fmt(r.cifraRepartidora) : 'Ninguna agrupación supera el umbral'],
          ].map(([k, v]) => (
            <tr key={k} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ ...celda, width: '45%', color: '#64748b' }}>{k}</td><td style={{ ...celda, fontWeight: 600 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table style={{ ...tabla, marginTop: '0.5rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            <th style={celda}>Agrupación</th><th style={{ ...celda, textAlign: 'right' }}>Votos</th>
            <th style={celda}>Supera umbral</th><th style={{ ...celda, textAlign: 'right' }}>Curules</th>
          </tr>
        </thead>
        <tbody>
          {r.agrupaciones.map((g) => (
            <tr key={g.nombre} style={{ borderTop: '1px solid #f1f5f9', fontWeight: g.curules > 0 ? 700 : 400 }}>
              <td style={celda}>{g.nombre}</td><td style={{ ...celda, textAlign: 'right' }}>{fmt(g.votos)}</td>
              <td style={celda}>{g.superaUmbral ? 'Sí' : 'No'}</td><td style={{ ...celda, textAlign: 'right' }}>{g.curules}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.empateUltimaCurul && <p style={{ ...nota, color: '#991b1b' }}>Hay empate en la última curul: la ley la define por sorteo.</p>}
      <p style={nota}>
        Calculado solo con las agrupaciones cargadas en el tarjetón del Día E. Si faltan agrupaciones, el umbral y la
        cifra no coincidirán con los de la comisión. Dentro de cada lista con voto preferente, las curules van a sus
        candidatos de mayor votación.
      </p>
    </>
  )
}
