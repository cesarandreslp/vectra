import { getDashboardDiaE, listTransmissions, getResultadosEnVivo, getMesasEnDisputa } from '../actions'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { AutoRefresh } from './_components/auto-refresh'
import { TablaTransmisiones } from './_components/tabla-transmisiones'
import { ChartVotacion } from './_components/chart-votacion'
import { AlertaDisputas } from './_components/alerta-disputas'

export default async function SalaDeSituacionPage() {
  await requireModuleOrRedirect('DIA_E', ['ADMIN_CAMPANA', 'COORDINADOR'])

  const [dashboard, transmissions, resultados, disputas] = await Promise.all([
    getDashboardDiaE(),
    listTransmissions(),
    getResultadosEnVivo(),
    getMesasEnDisputa(),
  ])

  return (
    // 15s: la transmisión llega en ráfagas al cierre de mesas.
    <AutoRefresh interval={15000}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>
          Sala de situación
        </h1>

        {/* Métricas en tiempo real */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.75rem',
        }}>
          <MetricCard label="Mesas totales" value={dashboard.mesasTotales} />
          <MetricCard label="Con testigo" value={dashboard.mesasConTestigo} color="#1e40af" />
          <MetricCard label="Transmitidas" value={dashboard.mesasTransmitidas} color="#0891b2" />
          <MetricCard label="Verificadas (3 fuentes)" value={dashboard.mesasVerificadas} color="#16a34a" />
          <MetricCard label="Incompletas" value={dashboard.mesasIncompletas} color="#d97706" />
          <MetricCard label="En disputa" value={dashboard.mesasDisputa} color="#ef4444" />
          <MetricCard label="Sin reportar" value={dashboard.mesasSinReportar} color="#94a3b8" />
        </div>

        {/* Fuentes que no cuadran — lo primero que debe ver la sala */}
        <AlertaDisputas mesas={disputas} />

        {/* Votación en vivo */}
        <ChartVotacion resultados={resultados} />

        {/* Incidentes */}
        {(dashboard.incidentesAlta > 0 || dashboard.incidentesMedia > 0 || dashboard.incidentesBaja > 0) && (
          <div style={{
            display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem',
            background: dashboard.incidentesAlta > 0 ? '#fee2e2' : '#fef3c7',
            borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500,
          }}>
            <span>Incidentes abiertos:</span>
            {dashboard.incidentesAlta > 0 && (
              <span style={{ color: '#991b1b' }}>{dashboard.incidentesAlta} alta</span>
            )}
            {dashboard.incidentesMedia > 0 && (
              <span style={{ color: '#92400e' }}>{dashboard.incidentesMedia} media</span>
            )}
            {dashboard.incidentesBaja > 0 && (
              <span style={{ color: '#64748b' }}>{dashboard.incidentesBaja} baja</span>
            )}
          </div>
        )}

        {/* Tabla de transmisiones */}
        <TablaTransmisiones transmissions={transmissions} />
      </div>
    </AutoRefresh>
  )
}

function MetricCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: color ?? '#0f172a' }}>{value}</div>
    </div>
  )
}
