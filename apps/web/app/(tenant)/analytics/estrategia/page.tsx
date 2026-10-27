import Link from 'next/link'
import { getEstrategia } from './actions'
import { BotonAnalizar } from './_components/boton-analizar'
import { Informe } from './_components/informe'

export const metadata = { title: 'Estrategia semanal' }
// "Analizar ahora" espera la respuesta de Claude, que puede tardar un par de minutos.
export const maxDuration = 300

const MODO: Record<string, string> = {
  AUTONOMO:     'Aplica los correctivos solo',
  SOLO_INFORME: 'Solo informa, no cambia nada',
  APAGADO:      'Apagado',
}

export default async function EstrategiaPage() {
  const data = await getEstrategia()
  const [ultimo, ...anteriores] = data.analisis

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 960 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>Estrategia semanal</h1>
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>
          Cada lunes Claude revisa el avance contra la meta y los hitos, y corrige metas de líderes y comunas,
          reasigna contactos de calle sin seguimiento y manda tareas por push. Todo queda aquí y se puede deshacer.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', background: '#f8fafc', borderRadius: 10, padding: '0.75rem 1rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#334155' }}>
          Modo: <strong>{MODO[data.modo]}</strong> · <Link href="/core/configuracion" style={{ color: '#2563eb' }}>cambiar</Link>
        </span>
        {!data.tieneClave && (
          <span style={{ fontSize: '0.85rem', color: '#b45309' }}>
            Falta la clave de Claude (Anthropic) en Configuración: sin ella el agente no corre.
          </span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <BotonAnalizar deshabilitado={!data.tieneClave || data.modo === 'APAGADO' || data.corrioEstaSemana} yaCorrio={data.corrioEstaSemana} />
        </div>
      </div>

      {ultimo
        ? <Informe analisis={ultimo} />
        : <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Todavía no hay análisis. El primero sale el próximo lunes, o con “Analizar ahora”.</p>}

      {anteriores.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Semanas anteriores ({anteriores.length})</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
            {anteriores.map((a) => <Informe key={a.id} analisis={a} />)}
          </div>
        </details>
      )}
    </div>
  )
}
