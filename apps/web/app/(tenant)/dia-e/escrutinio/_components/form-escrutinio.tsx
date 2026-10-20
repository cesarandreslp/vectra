'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { guardarEscrutinio, type DetalleMesaEscrutinio } from '../actions'

/** Votos del escrutinio de una mesa frente al E-14, con motivo obligatorio si algo cambia. */
export function FormEscrutinio({ mesa, motivos }: { mesa: DetalleMesaEscrutinio; motivos: string[] }) {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(mesa.filas.map((f) => [f.clave, String(f.escrutinio)])),
  )
  const [motivo, setMotivo] = useState('')
  const [observacion, setObservacion] = useState('')
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const numero = (clave: string) => Number(valores[clave] || 0)
  const cambiaContraGuardado = mesa.filas.some((f) => numero(f.clave) !== f.escrutinio)
  const total = mesa.filas.reduce((a, f) => a + numero(f.clave), 0)
  const totalE14 = mesa.filas.reduce((a, f) => a + (f.e14 ?? 0), 0)

  function guardar() {
    setMensaje(null)
    const datos = Object.fromEntries(mesa.filas.map((f) => [f.clave, numero(f.clave)]))
    startTransition(async () => {
      const res = await guardarEscrutinio(mesa.id, datos, motivo, observacion)
      if (res.success) {
        setMensaje({ ok: true, texto: 'Guardado.' }); setMotivo(''); setObservacion('')
        router.refresh()
      } else setMensaje({ ok: false, texto: res.error })
    })
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#64748b' }}>
            <th style={celda}>Candidato</th><th style={{ ...celda, textAlign: 'right' }}>E-14</th>
            <th style={{ ...celda, textAlign: 'right' }}>Escrutinio</th><th style={{ ...celda, textAlign: 'right' }}>Dif.</th>
          </tr>
        </thead>
        <tbody>
          {mesa.filas.map((f) => {
            const dif = f.e14 === null ? 0 : numero(f.clave) - f.e14
            return (
              <tr key={f.clave} style={{ borderTop: '1px solid #f1f5f9', background: dif !== 0 ? '#fffbeb' : undefined }}>
                <td style={celda}>{f.nombre}{f.agrupacion && <span style={{ color: '#94a3b8' }}> · {f.agrupacion}</span>}</td>
                <td style={{ ...celda, textAlign: 'right', color: '#64748b' }}>{f.e14 ?? '—'}</td>
                <td style={{ ...celda, textAlign: 'right' }}>
                  <input
                    type="number" min={0} step={1} inputMode="numeric" value={valores[f.clave]}
                    onChange={(e) => setValores((v) => ({ ...v, [f.clave]: e.target.value }))}
                    style={{ width: 80, padding: '0.3rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: 4, textAlign: 'right' }}
                  />
                </td>
                <td style={{ ...celda, textAlign: 'right', fontWeight: 600, color: dif > 0 ? '#166534' : dif < 0 ? '#991b1b' : '#94a3b8' }}>
                  {dif === 0 ? '—' : `${dif > 0 ? '+' : ''}${dif}`}
                </td>
              </tr>
            )
          })}
          <tr style={{ borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
            <td style={celda}>Total</td><td style={{ ...celda, textAlign: 'right' }}>{totalE14}</td>
            <td style={{ ...celda, textAlign: 'right' }}>{total}</td><td style={{ ...celda, textAlign: 'right' }}>{total - totalE14 || '—'}</td>
          </tr>
        </tbody>
      </table>

      {cambiaContraGuardado && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ ...campo, flex: '1 1 220px' }}>
            <option value="">Motivo de la corrección…</option>
            {motivos.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Observación (ej. número de reclamación)" style={{ ...campo, flex: '2 1 260px' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={guardar} disabled={isPending || (cambiaContraGuardado && !motivo)} style={{
          background: isPending || (cambiaContraGuardado && !motivo) ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none',
          borderRadius: 6, padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer',
        }}>
          {isPending ? 'Guardando…' : cambiaContraGuardado ? 'Guardar corrección' : mesa.estado === 'PENDIENTE' ? 'Revisada sin cambios' : 'Guardar'}
        </button>
        {mensaje && <span style={{ fontSize: '0.82rem', color: mensaje.ok ? '#166534' : '#991b1b' }}>{mensaje.texto}</span>}
      </div>
    </div>
  )
}

const celda: React.CSSProperties = { padding: '0.35rem 0.5rem' }
const campo: React.CSSProperties = { padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.82rem' }
