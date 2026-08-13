'use client'

/**
 * Invitar a un contacto a la campaña. El link y el QR NO se piden ni se generan
 * acá: cada elector ya tiene su QR desde que se crea, y quien se registre con él
 * queda colgando de él en la jerarquía. Al presionar invitar solo se arma el
 * mensaje con las dos cosas listas para mandar.
 */

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { IconWhatsapp, IconCopy, IconCheck } from '@/app/_components/icons'

export function Invitar({ qrToken, tenantSlug, nombre, compacto }: {
  qrToken: string
  tenantSlug: string
  /** Cómo lo llaman — el mensaje se firma con eso, no con un link pelado. */
  nombre: string
  /** En la home el QR arranca plegado para no comerse la pantalla. */
  compacto?: boolean
}) {
  const [link, setLink]       = useState('')
  const [qr, setQr]           = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [abierto, setAbierto] = useState(!compacto)

  // window.location.origin solo existe en cliente: así el link sirve igual en
  // vercel.app hoy y en el dominio propio cuando lo tengan.
  useEffect(() => {
    setLink(`${window.location.origin}/registro/${qrToken}?c=${tenantSlug}`)
  }, [qrToken, tenantSlug])

  useEffect(() => {
    if (!link) return
    QRCode.toDataURL(link, { width: 220, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null))
  }, [link])

  const mensaje = `¡Hola! Soy ${nombre} 👋 Te invito a que te registres, es rápido: ${link}`

  function copiar() {
    navigator.clipboard.writeText(mensaje)
      .then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2500) })
      .catch(() => {
        const el = document.createElement('input')
        el.value = mensaje
        document.body.appendChild(el); el.select(); document.execCommand('copy')
        document.body.removeChild(el)
        setCopiado(true); setTimeout(() => setCopiado(false), 2500)
      })
  }

  function descargarQr() {
    if (!qr) return
    const a = document.createElement('a')
    a.href = qr
    a.download = `invitacion-${nombre.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  if (!link) return null

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.85rem', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Invitar a alguien</div>
        {compacto && (
          <button
            onClick={() => setAbierto((v) => !v)}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            {abierto ? 'ocultar QR' : 'ver QR'}
          </button>
        )}
      </div>
      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.2rem 0 0.6rem' }}>
        Quien se registre con tu link o tu QR queda en tu grupo.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
          target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: '#25D366', color: '#fff', padding: '0.5rem 1rem',
            borderRadius: 8, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
          }}
        >
          <IconWhatsapp size={16} /> WhatsApp
        </a>
        <button
          onClick={copiar}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: copiado ? '#dcfce7' : '#f1f5f9', color: copiado ? '#166534' : '#475569',
            border: 'none', padding: '0.5rem 1rem', borderRadius: 8,
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {copiado ? <IconCheck size={14} /> : <IconCopy size={14} />}
          {copiado ? 'Copiado' : 'Copiar mensaje'}
        </button>
      </div>

      {abierto && qr && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR de invitación de ${nombre}`} style={{ width: 180, height: 180, borderRadius: 8, border: '1px solid #e2e8f0' }} />
          <button
            onClick={descargarQr}
            style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.35rem 0.75rem', fontSize: '0.78rem', cursor: 'pointer' }}
          >
            Descargar QR
          </button>
        </div>
      )}
    </div>
  )
}
