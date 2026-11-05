'use client'

/**
 * Botón para activar/desactivar los avisos push de la campaña (agenda,
 * encuestas, automatizaciones). Solo se muestra si el navegador soporta Push
 * y la cuenta tiene un elector enlazado (getEstadoPush).
 */

import { useEffect, useState } from 'react'
import { IconBell } from '@/app/_components/icons'
import { getEstadoPush, suscribirPush, desuscribirPush } from '../push-actions'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Safe)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function SuscripcionPush() {
  const [estado, setEstado] = useState<'oculto' | 'cargando' | 'inactivo' | 'activo' | 'error'>('cargando')
  const [publicKey, setPublicKey] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setEstado('oculto')
        return
      }

      const { publicKey: key, elegible } = await getEstadoPush()
      if (!key || !elegible) {
        setEstado('oculto')
        return
      }
      setPublicKey(key)

      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      setEstado(sub ? 'activo' : 'inactivo')
    })()
  }, [])

  async function activar() {
    if (!publicKey) return
    setEstado('cargando')
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        setEstado('inactivo')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const res = await suscribirPush({ endpoint: json.endpoint, keys: json.keys })
      setEstado(res.success ? 'activo' : 'error')
    } catch (err) {
      console.error('[PUSH] Error al suscribir:', err)
      setEstado('error')
    }
  }

  async function desactivar() {
    setEstado('cargando')
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      if (sub) {
        await desuscribirPush(sub.endpoint)
        await sub.unsubscribe()
      }
      setEstado('inactivo')
    } catch (err) {
      console.error('[PUSH] Error al desuscribir:', err)
      setEstado('error')
    }
  }

  if (estado === 'oculto' || estado === 'cargando') return null

  return (
    <button
      onClick={estado === 'activo' ? desactivar : activar}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        background: estado === 'activo' ? '#dcfce7' : '#f1f5f9',
        color: estado === 'activo' ? '#166534' : '#475569',
        border: '1px solid ' + (estado === 'activo' ? '#bbf7d0' : '#e2e8f0'),
        borderRadius: '8px', padding: '0.5rem 0.75rem',
        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginBottom: '0.75rem',
      }}
    >
      <IconBell size={15} />
      {estado === 'activo' ? 'Notificaciones activas' : estado === 'error' ? 'Reintentar activar notificaciones' : 'Activar notificaciones'}
    </button>
  )
}
