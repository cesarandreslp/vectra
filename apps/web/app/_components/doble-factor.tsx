'use client'

import { useState, useTransition } from 'react'
import { confirmarDobleFactor, desactivarDobleFactor, iniciarDobleFactor } from '@/app/_actions/doble-factor'

/** Activar o desactivar el doble factor de la propia cuenta. */
export function DobleFactor({ activoInicial }: { activoInicial: boolean }) {
  const [activo, setActivo] = useState(activoInicial)
  const [propuesta, setPropuesta] = useState<{ qr: string; clave: string } | null>(null)
  const [codigo, setCodigo] = useState('')
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendiente, iniciar] = useTransition()

  const caja: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 6, padding: '0.55rem 0.75rem', fontSize: '1.1rem', letterSpacing: '0.2em', width: '9rem' }
  const boton = (fondo: string): React.CSSProperties => ({ background: fondo, color: '#fff', border: 'none', borderRadius: 6, padding: '0.55rem 1rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', opacity: pendiente ? 0.6 : 1 })
  const correr = (f: () => Promise<void>) => iniciar(async () => { setMensaje(null); await f() })

  return (
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 520 }}>
      <div style={{ fontWeight: 700 }}>
        Doble factor: {activo ? <span style={{ color: '#166534' }}>activo</span> : <span style={{ color: '#b91c1c' }}>apagado</span>}
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
        Además de la contraseña, al entrar se pide el código de 6 dígitos de una app de autenticación
        (Google Authenticator, Microsoft Authenticator, Authy). Si alguien roba tu contraseña, igual no puede entrar.
      </p>

      {!activo && !propuesta && (
        <button type="button" disabled={pendiente} style={{ ...boton('#0f172a'), alignSelf: 'flex-start' }}
          onClick={() => correr(async () => { const r = await iniciarDobleFactor(); if ('error' in r) setMensaje({ ok: false, texto: r.error }); else setPropuesta(r) })}>
          Activar doble factor
        </button>
      )}

      {!activo && propuesta && (
        <>
          <ol style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li>Abre la app de autenticación en tu celular y escanea este código:</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={propuesta.qr} alt="Código QR para la app de autenticación" width={220} height={220} />
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>¿No puedes escanear? Escribe esta clave: <code>{propuesta.clave}</code></div>
          <div style={{ fontSize: '0.85rem', color: '#334155' }}>2. Escribe el código que muestra la app:</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" maxLength={7} placeholder="000000" style={caja} />
            <button type="button" disabled={pendiente} style={boton('#166534')}
              onClick={() => correr(async () => {
                const r = await confirmarDobleFactor(codigo)
                if (r.success) { setActivo(true); setPropuesta(null); setCodigo(''); setMensaje({ ok: true, texto: 'Listo: desde el próximo ingreso se te pedirá el código.' }) }
                else setMensaje({ ok: false, texto: r.error })
              })}>
              Confirmar
            </button>
          </div>
        </>
      )}

      {activo && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" maxLength={7} placeholder="000000" style={caja} />
          <button type="button" disabled={pendiente} style={boton('#b91c1c')}
            onClick={() => correr(async () => {
              const r = await desactivarDobleFactor(codigo)
              if (r.success) { setActivo(false); setCodigo(''); setMensaje({ ok: true, texto: 'Doble factor apagado.' }) }
              else setMensaje({ ok: false, texto: r.error })
            })}>
            Desactivar (pide un código vigente)
          </button>
        </div>
      )}
      {mensaje && <p style={{ margin: 0, fontSize: '0.85rem', color: mensaje.ok ? '#166534' : '#b91c1c' }}>{mensaje.texto}</p>}
    </section>
  )
}
