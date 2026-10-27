'use client'

import { useEffect, useState, useTransition } from 'react'
import { IconWhatsapp } from '@/app/_components/icons'
import { misContactosPorConvertir, marcarContacto, type ContactoPorConvertir } from '../calle/actions'

const TEMP: Record<string, { label: string; color: string }> = {
  FRIO: { label: 'Frío', color: '#60a5fa' }, TIBIO: { label: 'Tibio', color: '#f59e0b' }, CALIENTE: { label: 'Caliente', color: '#ef4444' },
}

/**
 * Gente que el candidato saludó en la zona de este líder y todavía no se
 * registra. Invitar abre WhatsApp con su link; al registrarse con el mismo
 * celular, el contacto sale solo de la bandeja.
 */
export function BandejaCalle({ qrToken, tenantSlug, nombre }: { qrToken: string; tenantSlug: string; nombre: string }) {
  const [contactos, setContactos] = useState<ContactoPorConvertir[]>([])
  const [, startTransition] = useTransition()

  useEffect(() => { misContactosPorConvertir().then(setContactos).catch(() => {}) }, [])
  if (contactos.length === 0) return null

  function marcar(c: ContactoPorConvertir, estado: 'INVITADO' | 'DESCARTADO') {
    setContactos((cs) => estado === 'DESCARTADO' ? cs.filter((x) => x.id !== c.id) : cs.map((x) => x.id === c.id ? { ...x, estado } : x))
    startTransition(async () => { await marcarContacto(c.id, estado) })
  }

  function invitar(c: ContactoPorConvertir) {
    const link = `${window.location.origin}/registro/${qrToken}?c=${tenantSlug}`
    const texto = `¡Hola ${c.nombre}! Soy ${nombre}, de la campaña 👋 Hace poco hablaste con nuestro candidato. Regístrate aquí, es rápido: ${link}`
    const tel = (c.telefono ?? '').replace(/\D/g, '').slice(-10)
    window.open(`https://wa.me/${tel ? `57${tel}` : ''}?text=${encodeURIComponent(texto)}`, '_blank')
    marcar(c, 'INVITADO')
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 10, padding: '0.85rem', marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.15rem' }}>Contactos del candidato por convertir ({contactos.length})</div>
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', color: '#64748b' }}>Los saludó en tu zona. Escríbeles para que se registren contigo.</p>
      {contactos.map((c) => (
        <div key={c.id} style={{ borderTop: '1px solid #f1f5f9', padding: '0.55rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              {c.nombre}
              {c.temperatura && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: TEMP[c.temperatura].color }}>● {TEMP[c.temperatura].label}</span>}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {new Date(c.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
              {c.estado === 'INVITADO' && ' · invitado'}
              {c.nota && ` · ${c.nota}`}
            </div>
          </div>
          <button type="button" onClick={() => invitar(c)} title="Invitar por WhatsApp"
            style={{ border: 'none', borderRadius: 8, background: '#22c55e', color: '#fff', padding: '0.45rem 0.6rem', cursor: 'pointer', display: 'inline-flex' }}>
            <IconWhatsapp size={18} />
          </button>
          <button type="button" onClick={() => marcar(c, 'DESCARTADO')} title="No le interesa"
            style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#94a3b8', padding: '0.4rem 0.55rem', cursor: 'pointer', fontSize: '0.8rem' }}>
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
