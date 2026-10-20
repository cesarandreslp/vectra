'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { guardarE26Oficial, type FormE26 as Datos, type FilaE26 } from '../actions'

/**
 * Columna del acta oficial vacía: solo se llena lo que la comisión dejó
 * distinto a nuestro escrutinio. Al reabrir, se ven llenas solo las celdas
 * guardadas que difieren del E-24 actual.
 */
export function FormE26({ form }: { form: Datos }) {
  const [acta, setActa] = useState<Record<string, string>>(
    Object.fromEntries(form.filas.map((f) => [f.clave, f.oficial !== null && f.oficial !== f.e24 ? String(f.oficial) : ''])),
  )
  const [observacion, setObservacion] = useState(form.observacion)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const oficial = (f: FilaE26) => (acta[f.clave] !== '' ? Number(acta[f.clave]) : f.e24)
  const suma = (fn: (f: FilaE26) => number) => form.filas.reduce((a, f) => a + fn(f), 0)
  const conDiferencia = form.filas.filter((f) => oficial(f) !== f.e24).length

  function guardar() {
    setMensaje(null)
    startTransition(async () => {
      const res = await guardarE26Oficial(form.zonaActual?.id ?? null, Object.fromEntries(form.filas.map((f) => [f.clave, oficial(f)])), observacion)
      if (res.success) { setMensaje({ ok: true, texto: 'E-26 guardado.' }); router.refresh() }
      else setMensaje({ ok: false, texto: res.error })
    })
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#64748b' }}>
              <th style={celda}>Candidato</th>
              <th style={der}>Preconteo (E-14)</th>
              <th style={der}>Escrutinio (E-24)</th>
              <th style={der}>E-26 oficial (solo lo distinto)</th>
              <th style={der}>Diferencia E-26 − E-24</th>
            </tr>
          </thead>
          <tbody>
            {form.filas.map((f) => {
              const dif = oficial(f) - f.e24
              return (
                <tr key={f.clave} style={{ borderTop: '1px solid #f1f5f9', background: dif !== 0 ? '#fef2f2' : undefined }}>
                  <td style={celda}>{f.nombre}{f.agrupacion && <span style={{ color: '#94a3b8' }}> · {f.agrupacion}</span>}</td>
                  <td style={{ ...der, color: '#94a3b8' }}>{f.e14}</td>
                  <td style={{ ...der, fontWeight: 600 }}>{f.e24}</td>
                  <td style={der}>
                    <input
                      type="number" min={0} step={1} inputMode="numeric" value={acta[f.clave]}
                      onChange={(e) => setActa((a) => ({ ...a, [f.clave]: e.target.value }))}
                      style={{ width: 90, padding: '0.3rem 0.4rem', border: `1px solid ${acta[f.clave] !== '' ? '#ef4444' : '#cbd5e1'}`, borderRadius: 4, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ ...der, fontWeight: 700, color: dif > 0 ? '#166534' : dif < 0 ? '#991b1b' : '#94a3b8' }}>
                    {dif === 0 ? '—' : `${dif > 0 ? '+' : ''}${dif}`}
                  </td>
                </tr>
              )
            })}
            <tr style={{ borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
              <td style={celda}>Total</td>
              <td style={der}>{suma((f) => f.e14)}</td>
              <td style={der}>{suma((f) => f.e24)}</td>
              <td style={der}>{suma(oficial)}</td>
              <td style={der}>{suma(oficial) - suma((f) => f.e24) || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <input
        value={observacion} onChange={(e) => setObservacion(e.target.value)}
        placeholder="Número del acta, folio, comisión que la expidió…"
        style={{ width: '100%', boxSizing: 'border-box', marginTop: '0.75rem', padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.82rem' }}
      />

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={guardar} disabled={isPending} style={{
          background: isPending ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer',
        }}>
          {isPending ? 'Guardando…' : 'Guardar E-26'}
        </button>
        <span style={{ fontSize: '0.82rem', color: conDiferencia ? '#991b1b' : '#166534', fontWeight: 600 }}>
          {conDiferencia ? `${conDiferencia} dato(s) no coinciden con nuestro escrutinio` : 'Coincide con nuestro escrutinio'}
        </span>
        {form.guardado && <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Guardado {new Date(form.guardado).toLocaleString('es-CO')}</span>}
        {mensaje && <span style={{ fontSize: '0.82rem', color: mensaje.ok ? '#166534' : '#991b1b' }}>{mensaje.texto}</span>}
      </div>
    </div>
  )
}

const celda: React.CSSProperties = { padding: '0.35rem 0.5rem' }
const der: React.CSSProperties = { ...celda, textAlign: 'right' }
