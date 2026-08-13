'use client'

/**
 * Ficha de elector en la PWA — optimizada para celular.
 * Botones grandes para cambiar el estado de compromiso.
 * Funciona offline: SWR cachea los datos de mis-electores.
 */

import { useState, useTransition } from 'react'
import { useRouter, useParams }    from 'next/navigation'
import useSWR                      from 'swr'
import { IconPhone, IconCheck } from '@/app/_components/icons'
import { VeredictoCompromiso } from '@/app/(tenant)/_components/veredicto-compromiso'
import { Invitar } from '../../_components/invitar'

type CommitmentStatus =
  | 'SIN_CONTACTAR'
  | 'CONTACTADO'
  | 'SIMPATIZANTE'
  | 'COMPROMETIDO'
  | 'VOTO_SEGURO'

interface Elector {
  id:               string
  name:             string
  apodo:            string | null
  phone:            string | null
  commitmentStatus: CommitmentStatus
  lastContact:      string | null
  notes:            string | null
  myQrToken:        string | null
}

const ESTADOS: { value: CommitmentStatus; label: string; color: string; bg: string }[] = [
  { value: 'SIN_CONTACTAR', label: 'Sin contactar', color: '#475569', bg: '#f1f5f9' },
  { value: 'CONTACTADO',    label: 'Contactado',    color: '#1e40af', bg: '#dbeafe' },
  { value: 'SIMPATIZANTE',  label: 'Simpatizante',  color: '#854d0e', bg: '#fef9c3' },
  { value: 'COMPROMETIDO',  label: 'Comprometido',  color: '#166534', bg: '#dcfce7' },
  { value: 'VOTO_SEGURO',   label: 'Voto seguro',   color: '#14532d', bg: '#bbf7d0' },
]

async function fetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Error al cargar')
  return res.json()
}

export default function FichaElectorPwaPage() {
  const params    = useParams()
  const voterId   = params.id as string
  const router    = useRouter()

  const [notas,     setNotas]     = useState('')
  const [feedback,  setFeedback]  = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)

  const [isPending, startTransition] = useTransition()

  // Obtener datos del elector del caché de mis-electores
  const { data } = useSWR<{ electores: Elector[]; tenantSlug: string | null }>('/api/core/mis-electores', fetcher, { keepPreviousData: true })
  const elector  = data?.electores.find((e) => e.id === voterId)

  function actualizarEstado(nuevoEstado: CommitmentStatus) {
    startTransition(async () => {
      try {
        // Intentar enviar al servidor; si falla, guardar offline
        const res = await fetch(`/api/core/electores/${voterId}/compromiso`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status:    nuevoEstado,
            notes:     notas || undefined,
            timestamp: new Date().toISOString(),
            offlineId: `${voterId}-${Date.now()}`,
          }),
        })

        if (res.ok) {
          setFeedback({ tipo: 'ok', msg: 'Estado actualizado.' })
          setTimeout(() => setFeedback(null), 2500)
        } else {
          // Guardar en localStorage para sincronizar después
          guardarOffline(voterId, nuevoEstado, notas)
          setFeedback({ tipo: 'ok', msg: 'Guardado localmente — se sincronizará al reconectar.' })
        }
      } catch {
        // Sin conexión — guardar offline
        guardarOffline(voterId, nuevoEstado, notas)
        setFeedback({ tipo: 'ok', msg: 'Sin conexión — guardado localmente.' })
      }
    })
  }

  if (!elector) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        <div>Cargando ficha...</div>
        <button onClick={() => router.back()} style={{ marginTop: '1rem', color: '#1e40af', background: 'none', border: 'none', cursor: 'pointer' }}>
          ← Volver
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>

      {/* Navegación */}
      <button
        onClick={() => router.back()}
        style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', marginBottom: '1rem', padding: 0 }}
      >
        ← Mis electores
      </button>

      {/* Nombre y estado actual */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem' }}>{elector.name}</h1>

        {/* Estado actual */}
        {(() => {
          const e = ESTADOS.find(e => e.value === elector.commitmentStatus)
          return e ? (
            <span style={{ background: e.bg, color: e.color, padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
              {e.label}
            </span>
          ) : null
        })()}

        {elector.lastContact && (
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
            Último contacto: {new Date(elector.lastContact).toLocaleDateString('es-CO')}
          </div>
        )}

        {/* Click to call */}
        {elector.phone && (
          <a
            href={`tel:${elector.phone}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.75rem',
              background: '#dbeafe', color: '#1e40af',
              padding: '0.5rem 1rem', borderRadius: '8px', textDecoration: 'none',
              fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            <IconPhone size={16} /> Llamar
          </a>
        )}

        {/* Su propio QR: quien se registre con él queda bajo él. El link y el
            QR ya existen desde que se creó el elector — acá solo se arman. */}
        {elector.myQrToken && (
          <div style={{ marginTop: '0.75rem' }}>
            <Invitar
              qrToken={elector.myQrToken}
              tenantSlug={data?.tenantSlug ?? ''}
              nombre={elector.apodo?.trim() || elector.name}
              compacto
            />
          </div>
        )}
      </div>

      <VeredictoCompromiso voterId={voterId} />

      {/* Botones de estado — grandes, optimizados para touch */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>
          Actualizar estado de compromiso
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {ESTADOS.map((e) => (
            <button
              key={e.value}
              onClick={() => actualizarEstado(e.value)}
              disabled={isPending || e.value === elector.commitmentStatus}
              style={{
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'space-between',
                background:   e.value === elector.commitmentStatus ? e.bg : '#fff',
                color:        e.value === elector.commitmentStatus ? e.color : '#475569',
                border:       `2px solid ${e.value === elector.commitmentStatus ? e.color : '#e2e8f0'}`,
                borderRadius: '10px',
                padding:      '0.875rem 1rem',
                cursor:       e.value === elector.commitmentStatus ? 'default' : 'pointer',
                fontSize:     '0.9rem',
                fontWeight:   600,
                textAlign:    'left',
                opacity:      isPending ? 0.7 : 1,
                transition:   'all 0.15s',
              }}
            >
              {e.label}
              {e.value === elector.commitmentStatus && <IconCheck size={16} />}
            </button>
          ))}
        </div>
      </div>

      {/* Notas rápidas */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>
          Notas (opcional)
        </label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Prefiere que lo llamen en las tardes..."
          rows={3}
          style={{
            width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0',
            borderRadius: '8px', fontSize: '0.875rem', resize: 'vertical',
            boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />
        {notas && (
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            Las notas se guardarán al actualizar el estado.
          </div>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          background: feedback.tipo === 'ok' ? '#dcfce7' : '#fee2e2',
          color:      feedback.tipo === 'ok' ? '#166534' : '#991b1b',
          padding:    '0.75rem 1rem', borderRadius: '8px', fontSize: '0.875rem',
        }}>
          {feedback.msg}
        </div>
      )}
    </div>
  )
}

const CLAVE = 'vectra_sync_pendiente'
/** Clave anterior al rebrand. Un celular que quedó sin sincronizar todavía la tiene. */
const CLAVE_VIEJA = 'campaignos_sync_pendiente'

/** Guarda un cambio pendiente en localStorage para sincronizar después */
function guardarOffline(voterId: string, status: CommitmentStatus, notes: string) {
  // Arrastrar lo que quedó en la clave vieja antes de escribir, si no esos
  // cambios se pierden en el celular de quien no había sincronizado.
  const viejos = JSON.parse(localStorage.getItem(CLAVE_VIEJA) ?? '[]')
  if (viejos.length > 0) {
    localStorage.setItem(CLAVE, JSON.stringify([...JSON.parse(localStorage.getItem(CLAVE) ?? '[]'), ...viejos]))
    localStorage.removeItem(CLAVE_VIEJA)
  }

  const pendientes = JSON.parse(localStorage.getItem(CLAVE) ?? '[]')
  pendientes.push({
    type:      'UPDATE_COMMITMENT',
    offlineId: `${voterId}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    payload:   { voterId, status, notes: notes || undefined },
  })
  localStorage.setItem(CLAVE, JSON.stringify(pendientes))
}
