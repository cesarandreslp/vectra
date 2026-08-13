'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { asignarGestor, quitarGestor, toggleAgendaAbierta, type GestionAgenda } from '../actions'

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }
const input = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.82rem' }
const btnPrimary = { background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer' }
const btnDanger = { background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer' }
const btnGhost = { background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer' }

function FilaGestor({ ambito, label, gestor, posibles, onChange }: {
  ambito: 'CANDIDATO' | 'JEFES'
  label: string
  gestor: { id: string; name: string } | null
  posibles: { id: string; name: string }[]
  onChange: () => void
}) {
  const [sel, setSel] = useState('')
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
      <span style={{ fontWeight: 600, minWidth: '170px' }}>{label}</span>
      {gestor ? (
        <>
          <span>Gestor: <strong>{gestor.name}</strong></span>
          <button onClick={async () => { await quitarGestor(ambito); onChange() }} style={btnGhost}>Quitar</button>
        </>
      ) : (
        <>
          <span style={{ color: '#94a3b8' }}>Sin gestor — lo administra el admin</span>
          <select value={sel} onChange={(e) => setSel(e.target.value)} style={input}>
            <option value="">Asignar a…</option>
            {posibles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button disabled={!sel} onClick={async () => { await asignarGestor(sel, ambito); onChange() }} style={{ ...btnPrimary, opacity: sel ? 1 : 0.5 }}>Asignar</button>
        </>
      )}
    </div>
  )
}

export function PanelGestion({ gestion }: { gestion: GestionAgenda }) {
  const router = useRouter()
  const refrescar = () => router.refresh()
  const [motivo, setMotivo] = useState('')
  const { candidato } = gestion

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Gestión de la agenda</h2>

      <FilaGestor ambito="CANDIDATO" label="Agenda del candidato" gestor={gestion.gestorCandidato} posibles={gestion.posiblesGestores} onChange={refrescar} />
      <FilaGestor ambito="JEFES" label="Agenda de jefes de debate" gestor={gestion.gestorJefes} posibles={gestion.posiblesGestores} onChange={refrescar} />

      {candidato && (
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600 }}>Reservas de electores:</span>
            <span style={{ color: candidato.agendaAbierta ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
              {candidato.agendaAbierta ? 'ABIERTA' : 'CERRADA'}
            </span>
            <input placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ ...input, flex: 1, minWidth: '160px' }} />
            <button
              onClick={async () => { await toggleAgendaAbierta(!candidato.agendaAbierta, motivo || undefined); setMotivo(''); refrescar() }}
              style={candidato.agendaAbierta ? btnDanger : btnPrimary}
            >
              {candidato.agendaAbierta ? 'Cerrar agenda' : 'Abrir agenda'}
            </button>
          </div>

          {gestion.bitacora.length > 0 && (
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Bitácora de aperturas</div>
              {gestion.bitacora.map((b) => (
                <div key={b.id}>
                  {new Date(b.createdAt).toLocaleString('es-CO')} · <strong>{b.abierta ? 'Abrió' : 'Cerró'}</strong> — {b.quien}{b.motivo ? ` · ${b.motivo}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
