'use client'

import { useEffect, useState } from 'react'
import { soyAnfitrion, getMiGestion } from './actions'
import { PanelAgendaAnfitrion } from './_components/panel-agenda-anfitrion'
import { PanelConvocar } from './_components/panel-convocar'
import { PanelAgendaElector } from './_components/panel-agenda-elector'
import { PanelAgendaGestor } from './_components/panel-agenda-gestor'

export default function PwaAgendaPage() {
  const [esAnfitrion, setEsAnfitrion] = useState<boolean | null>(null)
  const [gestion, setGestion] = useState<Awaited<ReturnType<typeof getMiGestion>> | undefined>(undefined)

  useEffect(() => {
    void soyAnfitrion().then(setEsAnfitrion)
    void getMiGestion().then(setGestion)
  }, [])

  const cargando = esAnfitrion === null || gestion === undefined

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Agenda</h1>
      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem' }}>
        {esAnfitrion
          ? 'Publica tus huecos disponibles y convoca a electores.'
          : gestion
            ? 'Administra la agenda que te asignaron.'
            : 'Consulta los horarios disponibles del candidato o jefes de debate y reserva tu cita.'}
      </p>

      {cargando && <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>Cargando...</div>}
      {!cargando && esAnfitrion && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <PanelAgendaAnfitrion />
          <PanelConvocar />
        </div>
      )}
      {!cargando && !esAnfitrion && gestion && gestion.anfitriones.length > 0 && <PanelAgendaGestor inicial={gestion} />}
      {/* Gestor asignado pero nadie marcado como candidato / jefe de debate: el
          formulario no tenía a nombre de quién publicar y fallaba con
          "Anfitrión no válido" al guardar. */}
      {!cargando && !esAnfitrion && gestion && gestion.anfitriones.length === 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '1rem', fontSize: '0.875rem', color: '#92400e' }}>
          Te asignaron la agenda {gestion.ambito === 'CANDIDATO' ? 'del candidato' : 'de los jefes de debate'}, pero la campaña
          todavía no marcó {gestion.ambito === 'CANDIDATO' ? 'a nadie como candidato' : 'a ningún jefe de debate'}.
          Pídele al administrador que lo haga (Líderes → ficha → {gestion.ambito === 'CANDIDATO' ? '"Marcar como candidato"' : '"Marcar como jefe de debate"'}) y vuelve a entrar aquí.
        </div>
      )}
      {!cargando && !esAnfitrion && !gestion && <PanelAgendaElector />}
    </div>
  )
}
