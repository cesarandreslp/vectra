import type { PlanView } from '../actions-plan'
import type { ConteosProspectos } from '../actions-prospectos'
import { ETAPAS } from '../_lib/etapas'
import { Bloque } from './estructura-panel'
import { fmt, nota } from './meta-cascada'

/** Lista de los 100: el embudo de reclutamiento al lado de los líderes que pide la cascada. */
export function Lista100({ plan, conteos }: { plan: PlanView; conteos: ConteosProspectos }) {
  const faltan    = plan.necesario ? Math.max(0, plan.necesario.lideres - plan.real.lideres) : null
  const enCamino  = conteos.porEtapa.CANDIDATO + conteos.porEtapa.CONVERSADO

  return (
    <Bloque titulo="Lista de los 100" editar="/core/estructura/prospectos">
      <p style={nota}>
        {faltan === null
          ? 'Sin meta de votos: no hay cuántos líderes exige la cascada.'
          : faltan === 0
            ? `La cascada pide ${fmt(plan.necesario!.lideres)} líderes y ya están.`
            : `Faltan ${fmt(faltan)} líderes según la cascada · ${fmt(enCamino)} prospectos en camino${enCamino < faltan ? ' — no alcanzan' : ''}.`}
        {conteos.aceptadosSinRed > 0 && ` ${fmt(conteos.aceptadosSinRed)} aceptaron pero aún no tienen red.`}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
        {faltan !== null && <Tile label="Líderes faltantes" valor={faltan} color={faltan ? '#b91c1c' : '#15803d'} />}
        {ETAPAS.map((e) => <Tile key={e.key} label={e.label} valor={conteos.porEtapa[e.key]} color={e.color} />)}
      </div>
    </Bloque>
  )
}

function Tile({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{label}</p>
      <p style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: 600, color }}>{fmt(valor)}</p>
    </div>
  )
}
