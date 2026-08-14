import Link from 'next/link'
import { getCoreStats, getVotersGeo, getGeoStats, getVotingStationsGeo, getJurisdictionStats, getElectoresPorComuna, getElectoresPorBarrio, getLeaderRanking, getCentroMunicipio } from './actions'
import { MapaElectores } from './_components/mapa-electores'

export const metadata = { title: 'Dashboard' }

// La acción geocodificarPendientes hace hasta 5 llamadas a Nominatim con pausa
// de 1s; ampliamos el límite de la función serverless para que no la corte.
export const maxDuration = 60

/**
 * Dashboard del módulo CORE. Es el destino post-login de todo rol de tenant
 * (ver app/page.tsx y app/login/page.tsx), así que debe existir y cargar rápido.
 */
export default async function CoreDashboardPage() {
  const [stats, puntos, geoStats, puestos, jurisdiccion, comunas, barrios, ranking, centro] = await Promise.all([
    getCoreStats(),
    getVotersGeo(),
    getGeoStats(),
    getVotingStationsGeo(),
    getJurisdictionStats(),
    getElectoresPorComuna(),
    getElectoresPorBarrio(),
    getLeaderRanking(5),
    getCentroMunicipio(),
  ])

  const tarjetas = [
    { label: 'Líderes',   valor: stats.lideres,   href: '/core/lideres' },
    { label: 'Electores', valor: stats.electores, href: '/core/electores' },
    { label: 'Puestos',   valor: stats.puestos,   href: null },
    { label: 'Mesas',     valor: stats.mesas,     href: null },
  ]

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {tarjetas.map((t) => {
          const cuerpo = (
            <div
              style={{
                background:   '#fff',
                border:       '1px solid #e2e8f0',
                borderRadius: '8px',
                padding:      '1.5rem',
                height:       '100%',
              }}
            >
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>{t.valor}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>{t.label}</div>
            </div>
          )

          return t.href
            ? <Link key={t.label} href={t.href} style={{ textDecoration: 'none' }}>{cuerpo}</Link>
            : <div key={t.label}>{cuerpo}</div>
        })}
      </div>

      {/* Mapa de electores geolocalizados */}
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Mapa de electores</h2>
        <MapaElectores puntos={puntos} geoStats={geoStats} puestos={puestos} comunas={comunas} barrios={barrios} centro={centro} />

        <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1rem', fontSize: '0.85rem' }}>
          <span style={{ color: '#166534' }}>{jurisdiccion.cuenta} cuentan</span>
          <span style={{ color: '#991b1b' }}>{jurisdiccion.noCuenta} fuera de jurisdicción</span>
          <span style={{ color: '#64748b' }}>{jurisdiccion.sinVerificar} sin verificar (sin mesa asignada)</span>
        </div>
      </div>

      {/* Ranking de captadores */}
      <div style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Ranking de líderes</h2>
          <Link href="/core/lideres/ranking" style={{ fontSize: '0.85rem', color: '#1e40af', textDecoration: 'none' }}>
            Ver más →
          </Link>
        </div>

        {ranking.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Todavía no hay líderes con electores propios.</p>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            {ranking.map((l, i) => (
              <Link
                key={l.id} href={`/core/lideres/${l.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.25rem',
                  textDecoration: 'none', color: 'inherit',
                  borderTop: i === 0 ? 'none' : '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontWeight: 700, color: '#94a3b8', width: '1.5rem' }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{l.name}</div>
                  {l.zone && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{l.zone}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>{l.totalDownline}</div>
                  <div>{l.comprometidosDownline} comprometidos{l.profundidad > 0 ? ` · ${l.profundidad} nivel(es)` : ''}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
