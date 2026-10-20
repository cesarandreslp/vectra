import type { DatosE26 } from '../../actions'
import { numeroALetras } from '@/lib/numero-a-letras'
import { SeccionCurules } from './seccion-curules'
import { tabla, celda, subtitulo, nota } from './estilos'

/** Cargos que eligen corporación (listas, cifra repartidora); el resto es uninominal. */
export const CORPORACIONES = ['CONCEJAL', 'DIPUTADO', 'REPRESENTANTE', 'SENADOR']

const CORPORACION: Record<string, string> = {
  CONCEJAL: 'Concejo municipal', ALCALDE: 'Alcaldía', DIPUTADO: 'Asamblea departamental', GOBERNADOR: 'Gobernación',
  REPRESENTANTE: 'Cámara de Representantes', SENADOR: 'Senado de la República', PRESIDENTE: 'Presidencia de la República',
}

const fmt = (n: number) => n.toLocaleString('es-CO')

export function ActaE26({ datos, curules }: { datos: DatosE26; curules: number | null }) {
  const validos = datos.agrupaciones.reduce((a, g) => a + g.total, 0) + datos.blanco
  const ganador = datos.cargo && !CORPORACIONES.includes(datos.cargo)
    ? datos.agrupaciones.flatMap((g) => g.candidatos).sort((a, b) => b.votos - a.votos)[0]
    : null

  return (
    <div className="area-impresion" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1.5rem', fontSize: '0.85rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>CONSOLIDADO DE ESCRUTINIO — FORMATO E-26</div>
        <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.2rem' }}>
          Copia de control de la campaña, armada con los E-14 transmitidos por sus testigos. No reemplaza el acta oficial
          que expide la comisión escrutadora: sirve para cotejarla y sustentar reclamaciones.
        </div>
      </div>

      <table style={tabla}>
        <tbody>
          <Fila k="Departamento" v={datos.departamento} />
          <Fila k="Municipio" v={datos.municipio} />
          <Fila k="Corporación / cargo" v={datos.cargo ? CORPORACION[datos.cargo] ?? datos.cargo : 'Sin configurar'} />
          <Fila k="Alcance" v={datos.zonaActual ? `Parcial — Zona ${datos.zonaActual.code}${datos.zonaActual.name ? ` (${datos.zonaActual.name})` : ''}` : 'General — todo el municipio'} />
          <Fila k="Mesas con E-14" v={`${fmt(datos.mesasReportadas)} de ${fmt(datos.mesasTotales)}${datos.mesasReportadas < datos.mesasTotales ? ' — consolidado incompleto' : ''}`} />
          <Fila k="Generado" v={new Date().toLocaleString('es-CO')} />
        </tbody>
      </table>

      <h3 style={subtitulo}>Votación por agrupación y candidato</h3>
      <table style={tabla}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            <th style={celda}>Agrupación / candidato</th><th style={{ ...celda, textAlign: 'right' }}>Votos</th><th style={celda}>En letras</th>
          </tr>
        </thead>
        <tbody>
          {datos.agrupaciones.map((g) => [
            ...(g.candidatos.length > 1 || g.candidatos[0]?.nombre !== g.nombre
              ? [<FilaVotos key={g.nombre} nombre={g.nombre} votos={g.total} negrita />]
              : []),
            ...g.candidatos.map((c) => (
              <FilaVotos key={`${g.nombre}-${c.nombre}`} nombre={c.nombre} votos={c.votos} sangria={g.candidatos.length > 1 || c.nombre !== g.nombre} propio={c.propio} />
            )),
          ])}
          <FilaVotos nombre="Votos en blanco" votos={datos.blanco} negrita />
          <FilaVotos nombre="Total votos válidos (agrupaciones + blanco)" votos={validos} negrita fondo />
          <FilaVotos nombre="Votos nulos" votos={datos.nulos} negrita />
          <FilaVotos nombre="Total votos (válidos + nulos)" votos={validos + datos.nulos} negrita fondo />
        </tbody>
      </table>
      <p style={nota}>Los votos no marcados no se transmiten desde la app de testigos, así que no suman aquí.</p>

      {ganador && <p style={{ marginTop: '0.75rem' }}><b>Mayor votación:</b> {ganador.nombre} con {fmt(ganador.votos)} votos ({numeroALetras(ganador.votos)}).</p>}
      {curules && <SeccionCurules agrupaciones={datos.agrupaciones} blanco={datos.blanco} curules={curules} />}

      {datos.mesasSinReporte.length > 0 && (
        <>
          <h3 style={subtitulo}>Mesas sin E-14 transmitido ({fmt(datos.mesasSinReporte.length)})</h3>
          <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.6 }}>
            {datos.mesasSinReporte.map((m) => `${m.puesto} – mesa ${m.mesa}`).join(' · ')}
          </p>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem', marginTop: '3rem' }}>
        {['Elaboró (testigo electoral / apoderado)', 'Revisó (gerente o abogado de la campaña)'].map((f) => (
          <div key={f} style={{ borderTop: '1px solid #0f172a', paddingTop: '0.3rem', fontSize: '0.75rem', color: '#475569' }}>{f}</div>
        ))}
      </div>
    </div>
  )
}

function Fila({ k, v }: { k: string; v: string }) {
  return <tr style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ ...celda, width: '35%', color: '#64748b' }}>{k}</td><td style={{ ...celda, fontWeight: 600 }}>{v}</td></tr>
}

function FilaVotos({ nombre, votos, negrita, sangria, propio, fondo }: {
  nombre: string; votos: number; negrita?: boolean; sangria?: boolean; propio?: boolean; fondo?: boolean
}) {
  return (
    <tr style={{ borderTop: '1px solid #f1f5f9', fontWeight: negrita ? 700 : 400, background: fondo ? '#f8fafc' : propio ? '#fef9c3' : undefined }}>
      <td style={{ ...celda, paddingLeft: sangria ? '1.75rem' : celda.padding as string }}>{nombre}{propio ? ' ★' : ''}</td>
      <td style={{ ...celda, textAlign: 'right' }}>{fmt(votos)}</td>
      <td style={{ ...celda, color: '#475569' }}>{numeroALetras(votos)}</td>
    </tr>
  )
}
