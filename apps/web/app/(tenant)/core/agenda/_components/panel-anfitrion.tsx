'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getAgendaDeAnfitrion, getConvocatoriasDeAnfitrion,
  type AnfitrionOption, type EntradaAgendaAdmin, type ConvocatoriaAdminListado,
} from '../actions'
import { CalendarioMensual } from '@/app/_components/calendario-mensual'
import { ItemEntradaAgenda, eventoDeEntrada, entradasDelDia } from '@/app/_components/entrada-agenda'
import { FormCrearEntrada } from './form-crear-entrada'

export function PanelAnfitrion({ anfitriones }: { anfitriones: AnfitrionOption[] }) {
  const [anfitrionId, setAnfitrionId] = useState(anfitriones[0]?.id ?? '')
  const [agenda, setAgenda] = useState<EntradaAgendaAdmin[]>([])
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaAdminListado[]>([])
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null)

  const cargar = useCallback(() => {
    if (!anfitrionId) return
    void getAgendaDeAnfitrion(anfitrionId).then(setAgenda)
    void getConvocatoriasDeAnfitrion(anfitrionId).then(setConvocatorias)
  }, [anfitrionId])

  useEffect(() => {
    setDiaSeleccionado(null)
    cargar()
  }, [anfitrionId, cargar])

  if (anfitriones.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', color: '#94a3b8', fontSize: '0.875rem' }}>
        Todavía no hay candidato ni jefes de debate marcados.
      </div>
    )
  }

  const eventos = agenda.map(eventoDeEntrada)
  const entradasDelDiaSel = entradasDelDia(agenda, diaSeleccionado)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <select
        value={anfitrionId} onChange={(e) => setAnfitrionId(e.target.value)}
        style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.875rem', maxWidth: '320px' }}
      >
        {anfitriones.map((a) => (
          <option key={a.id} value={a.id}>{a.name}{a.isCandidate ? ' (candidato)' : ' (jefe de debate)'}</option>
        ))}
      </select>

      <CalendarioMensual eventos={eventos} onDiaClick={(fecha) => setDiaSeleccionado(fecha)} />

      <FormCrearEntrada anfitrionId={anfitrionId} onCreada={cargar} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            {diaSeleccionado
              ? diaSeleccionado.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
              : 'Detalle del día'}
          </h3>
          {!diaSeleccionado && <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Toca un día del calendario para ver el detalle.</div>}
          {diaSeleccionado && entradasDelDiaSel.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sin entradas ese día.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {entradasDelDiaSel.map((e) => <ItemEntradaAgenda key={e.id} e={e} onCambio={cargar} />)}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Convocatorias enviadas</h3>
          {convocatorias.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sin convocatorias.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {convocatorias.map((c) => (
              <div key={c.id} style={{ fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <div style={{ fontWeight: 600 }}>{c.titulo}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                  {new Date(c.startsAt).toLocaleString('es-CO')} · {c.totalDestinatarios} convocado(s){c.lugar ? ` · ${c.lugar}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
