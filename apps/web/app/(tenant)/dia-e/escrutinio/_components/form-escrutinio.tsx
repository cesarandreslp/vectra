'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { guardarEscrutinio, type DetalleMesaEscrutinio } from '../actions'

type Fila = DetalleMesaEscrutinio['filas'][number]

/**
 * Formulario E-24 de una mesa: el preconteo (E-14) queda fijo y la columna de
 * corrección arranca VACÍA — solo se llena el dato que la comisión cambió.
 * Lo que no se toca queda con el valor del preconteo.
 */
export function FormEscrutinio({ mesa, motivos, siguienteHref }: {
  mesa: DetalleMesaEscrutinio; motivos: string[]; siguienteHref: string | null
}) {
  // Corrección ya guardada = dato del escrutinio distinto del preconteo (o mesa sin E-14 ya revisada).
  const corregidaGuardada = (f: Fila) =>
    f.e14 === null ? (mesa.estado !== 'PENDIENTE' ? String(f.escrutinio) : '') : f.escrutinio !== f.e14 ? String(f.escrutinio) : ''
  const [correcciones, setCorrecciones] = useState<Record<string, string>>(
    Object.fromEntries(mesa.filas.map((f) => [f.clave, corregidaGuardada(f)])),
  )
  const [motivo, setMotivo] = useState('')
  const [observacion, setObservacion] = useState('')
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const resultado = (f: Fila) => (correcciones[f.clave] !== '' ? Number(correcciones[f.clave]) : f.e14 ?? 0)
  const sinE14 = mesa.filas.every((f) => f.e14 === null)
  const cambiaContraGuardado = mesa.filas.some((f) => resultado(f) !== f.escrutinio)
  // Sin E-14 no hay preconteo que corregir: se digita lo de la comisión, sin motivo.
  const hayCorreccion = !sinE14 && mesa.filas.some((f) => resultado(f) !== f.e14)
  const pideMotivo = cambiaContraGuardado && hayCorreccion
  const suma = (fn: (f: Fila) => number) => mesa.filas.reduce((a, f) => a + fn(f), 0)

  function guardar(irASiguiente: boolean) {
    setMensaje(null)
    const datos = Object.fromEntries(mesa.filas.map((f) => [f.clave, resultado(f)]))
    startTransition(async () => {
      const res = await guardarEscrutinio(mesa.id, datos, motivo, observacion)
      if (!res.success) { setMensaje({ ok: false, texto: res.error }); return }
      if (irASiguiente && siguienteHref) router.push(siguienteHref)
      else { setMensaje({ ok: true, texto: 'Mesa guardada.' }); setMotivo(''); setObservacion(''); router.refresh() }
    })
  }

  const bloqueado = isPending || (pideMotivo && !motivo)

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#64748b' }}>
            <th style={celda}>Candidato</th>
            <th style={{ ...celda, textAlign: 'right' }}>Preconteo (E-14)</th>
            <th style={{ ...celda, textAlign: 'right' }}>Corrección de la comisión</th>
            <th style={{ ...celda, textAlign: 'right' }}>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {mesa.filas.map((f) => {
            const dif = resultado(f) - (f.e14 ?? 0)
            return (
              <tr key={f.clave} style={{ borderTop: '1px solid #f1f5f9', background: f.e14 !== null && dif !== 0 ? '#fffbeb' : undefined }}>
                <td style={celda}>{f.nombre}{f.agrupacion && <span style={{ color: '#94a3b8' }}> · {f.agrupacion}</span>}</td>
                <td style={{ ...celda, textAlign: 'right', color: '#64748b' }}>{f.e14 ?? '—'}</td>
                <td style={{ ...celda, textAlign: 'right' }}>
                  <input
                    type="number" min={0} step={1} inputMode="numeric" value={correcciones[f.clave]}
                    placeholder={f.e14 === null ? 'votos' : ''}
                    onChange={(e) => setCorrecciones((c) => ({ ...c, [f.clave]: e.target.value }))}
                    style={{ width: 90, padding: '0.3rem 0.4rem', border: `1px solid ${correcciones[f.clave] !== '' ? '#f59e0b' : '#cbd5e1'}`, borderRadius: 4, textAlign: 'right' }}
                  />
                </td>
                <td style={{ ...celda, textAlign: 'right', fontWeight: 600 }}>
                  {resultado(f)}
                  {f.e14 !== null && dif !== 0 && <span style={{ color: dif > 0 ? '#166534' : '#991b1b', marginLeft: 4, fontWeight: 400 }}>({dif > 0 ? '+' : ''}{dif})</span>}
                </td>
              </tr>
            )
          })}
          <tr style={{ borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
            <td style={celda}>Total</td>
            <td style={{ ...celda, textAlign: 'right' }}>{suma((f) => f.e14 ?? 0)}</td>
            <td style={celda} />
            <td style={{ ...celda, textAlign: 'right' }}>{suma(resultado)}</td>
          </tr>
        </tbody>
      </table>

      {pideMotivo && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ ...campo, flex: '1 1 220px' }}>
            <option value="">Motivo de la corrección…</option>
            {motivos.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Observación (ej. número de reclamación)" style={{ ...campo, flex: '2 1 260px' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => guardar(false)} disabled={bloqueado} style={boton(bloqueado ? '#94a3b8' : '#0f172a')}>
          {isPending ? 'Guardando…' : hayCorreccion ? 'Guardar corrección' : sinE14 ? 'Guardar mesa' : 'Revisada sin cambios'}
        </button>
        {siguienteHref && (
          <button type="button" onClick={() => guardar(true)} disabled={bloqueado} style={boton(bloqueado ? '#94a3b8' : '#1e40af')}>
            Guardar y siguiente mesa →
          </button>
        )}
        {mensaje && <span style={{ fontSize: '0.82rem', color: mensaje.ok ? '#166534' : '#991b1b' }}>{mensaje.texto}</span>}
      </div>
    </div>
  )
}

const celda: React.CSSProperties = { padding: '0.35rem 0.5rem' }
const campo: React.CSSProperties = { padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.82rem' }
const boton = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' })
