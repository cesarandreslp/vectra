'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { encolar, pendientes, quitar } from '@/lib/cola-offline'
import { registrarContactos, type ContactoNuevo, type MiDia } from '../actions'
import { FichaCalle } from './ficha-calle'

/**
 * Captura de calle: "+1 saludo" de un toque y ficha corta. Todo pasa primero
 * por la cola del celular y sube cuando hay señal, así en la calle nunca se
 * pierde un contacto por falta de datos.
 */
export function CapturaCalle({ dia }: { dia: MiDia }) {
  const [pend, setPend] = useState<ContactoNuevo[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const router = useRouter()

  const subir = useCallback(async () => {
    const cola = await pendientes<ContactoNuevo>()
    setPend(cola)
    if (cola.length === 0 || !navigator.onLine) return
    setSubiendo(true)
    try {
      for (let i = 0; i < cola.length; i += 200) {
        const lote = cola.slice(i, i + 200)
        const res = await registrarContactos(lote)
        if (!res.success) break // inválido o sin permiso: queda en la cola, no se pierde
        await quitar(lote.map((c) => c.id))
      }
      router.refresh()
    } catch {
      // sin red a mitad de camino: lo que no subió sigue en la cola
    } finally {
      setPend(await pendientes<ContactoNuevo>())
      setSubiendo(false)
    }
  }, [router])

  useEffect(() => {
    subir()
    window.addEventListener('online', subir)
    return () => window.removeEventListener('online', subir)
  }, [subir])

  async function agregar(c: Omit<ContactoNuevo, 'id' | 'fecha'>) {
    const item: ContactoNuevo = { ...c, id: crypto.randomUUID(), fecha: new Date().toISOString() }
    await encolar(item)
    setPend((p) => [...p, item])
    subir()
  }

  const saludos = dia.saludos + pend.filter((c) => !c.nombre).length
  const fichas  = dia.fichas + pend.filter((c) => c.nombre).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <button
        type="button" onClick={() => agregar({})}
        style={{
          border: 'none', borderRadius: 16, padding: '1.5rem 1rem', background: '#1e40af', color: '#fff',
          fontSize: '1.5rem', fontWeight: 800, cursor: 'pointer', touchAction: 'manipulation',
        }}
      >
        +1 saludo
        <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, opacity: 0.85, marginTop: '0.25rem' }}>
          Hoy: {saludos + fichas} personas · {fichas} con datos
        </span>
      </button>

      {pend.length > 0 && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#b45309', textAlign: 'center' }}>
          {subiendo ? 'Subiendo…' : `${pend.length} pendiente(s) por subir — se envían solos cuando haya señal.`}
        </p>
      )}

      <FichaCalle onGuardar={agregar} />

      {dia.ultimos.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '0.85rem 1rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Hoy con datos</p>
          {dia.ultimos.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.25rem 0', color: '#334155' }}>
              <span>{c.nombre}</span><span style={{ color: '#94a3b8' }}>{c.hora}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
