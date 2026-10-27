import type { ContactosCalleView } from '../actions-contactos'
import { Bloque } from './estructura-panel'
import { fmt, nota, tabla, th, thN, td, tdN } from './meta-cascada'

/** Contactos de calle del candidato. No entran a la cascada hasta que se registran como electores. */
export function ContactosCalle({ data }: { data: ContactosCalleView }) {
  const { resumen: r, porComuna, rezagados } = data
  const pct = r.fichas ? Math.round((r.convertidos / r.fichas) * 100) : 0

  return (
    <Bloque titulo="Contactos de calle del candidato" editar="/pwa/calle">
      {r.saludos + r.fichas === 0 ? (
        <p style={nota}>Aún no hay contactos. El candidato (o quien lo acompaña) los anota desde la app, en la pestaña Calle.</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '0.9rem' }}>
            <Cifra label="Hoy" valor={fmt(r.hoy)} />
            <Cifra label="Últimos 7 días" valor={fmt(r.semana)} />
            <Cifra label="Con datos" valor={fmt(r.fichas)} sub={`${fmt(r.saludos)} solo saludos`} />
            <Cifra label="Ya son electores" valor={fmt(r.convertidos)} sub={`${pct} % de los que dieron datos`} />
            <Cifra label="Sin seguimiento (+3 días)" valor={fmt(r.sinSeguimiento)} alerta={r.sinSeguimiento > 0} />
          </div>
          <p style={nota}>Los saludos no cuentan como contactos de la meta en cascada: cuentan cuando la persona se registra.</p>

          {porComuna.length > 0 && (
            <table style={{ ...tabla, marginBottom: '0.9rem' }}>
              <thead><tr><th style={th}>Zona</th><th style={thN}>Con datos</th><th style={thN}>Convertidos</th></tr></thead>
              <tbody>
                {porComuna.map((z) => (
                  <tr key={z.comuna}><td style={td}>{z.comuna}</td><td style={tdN}>{fmt(z.fichas)}</td><td style={tdN}>{fmt(z.convertidos)}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          {rezagados.length > 0 && (
            <>
              <p style={{ ...nota, fontWeight: 600, color: '#0f172a', margin: '0 0 0.4rem' }}>Se están enfriando</p>
              <table style={tabla}>
                <thead><tr><th style={th}>Persona</th><th style={th}>Zona</th><th style={th}>Líder</th><th style={thN}>Días</th></tr></thead>
                <tbody>
                  {rezagados.map((c) => (
                    <tr key={c.id}>
                      <td style={td}>{c.nombre}</td>
                      <td style={td}>{c.comuna ?? '—'}</td>
                      <td style={{ ...td, color: c.lider ? '#0f172a' : '#b45309' }}>{c.lider ?? 'Sin líder en la zona'}</td>
                      <td style={{ ...tdN, color: '#b91c1c' }}>{c.dias}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </Bloque>
  )
}

function Cifra({ label, valor, sub, alerta }: { label: string; valor: string; sub?: string; alerta?: boolean }) {
  return (
    <div style={{ background: alerta ? '#fffbeb' : '#f8fafc', borderRadius: 8, padding: '0.55rem 0.7rem' }}>
      <p style={{ margin: 0, fontSize: '0.72rem', color: alerta ? '#b45309' : '#64748b' }}>{label}</p>
      <p style={{ margin: '0.1rem 0 0', fontSize: '1.25rem', fontWeight: 600, color: alerta ? '#b45309' : '#0f172a' }}>{valor}</p>
      {sub && <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>{sub}</p>}
    </div>
  )
}
