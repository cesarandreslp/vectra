'use client'

/**
 * Panel de gestión de QR de captación.
 * Permite generar, ver y desactivar QR por líder.
 */

import { useState, useTransition, useEffect } from 'react'
import { QrImage }        from './_components/qr-image'
import { generarQR, toggleQR } from '../../../registro/[token]/actions'
import { generarQrFaltantes }  from '../actions'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface QrRow {
  id:                 string
  leaderId:           string
  token:              string
  isActive:           boolean
  expiresAt:          string | null
  registrationsCount: number
  createdAt:          string
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function QrPage() {
  const [qrs,          setQrs]          = useState<QrRow[]>([])
  const [lideres,      setLideres]      = useState<{ id: string; name: string }[]>([])
  const [tenantId,     setTenantId]     = useState('')
  const [tenantSlug,   setTenantSlug]   = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [liderSel,     setLiderSel]     = useState('')
  const [qrActivo,     setQrActivo]     = useState<QrRow | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [aviso,        setAviso]        = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  // Cargar QR existentes y líderes al montar
  useEffect(() => {
    fetch('/api/core/qr')
      .then(r => r.json())
      .then(d => {
        setQrs(d.qrs ?? [])
        setLideres(d.lideres ?? [])
        setTenantId(d.tenantId ?? '')
        setTenantSlug(d.tenantSlug ?? '')
      })
      .catch(() => setError('No se pudieron cargar los QR.'))
  }, [])

  function construirUrl(token: string) {
    // El slug va en el path (?c=) para resolver el tenant sin depender del
    // subdominio (que requiere DNS). El origin actual hace que el QR funcione
    // en vercel.app hoy y en el dominio propio cuando exista.
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/registro/${token}?c=${tenantSlug}`
  }

  function handleGenerar() {
    if (!liderSel) return
    startTransition(async () => {
      const res = await generarQR(liderSel, tenantId)
      if (res.success) {
        // Recargar lista
        const nuevoQr: QrRow = {
          id:                 res.qrId,
          leaderId:           liderSel,
          token:              res.token,
          isActive:           true,
          expiresAt:          null,
          registrationsCount: 0,
          createdAt:          new Date().toISOString(),
        }
        setQrs(prev => [nuevoQr, ...prev])
        setQrActivo(nuevoQr)
        setModalAbierto(false)
        setLiderSel('')
      } else {
        setError(res.error)
      }
    })
  }

  // Los electores que entraron por fuera de la app (una siembra, una carga
  // directa) no tienen su QR. Esto se los crea sin tocar a los que ya lo tienen.
  function handleGenerarFaltantes() {
    startTransition(async () => {
      const { creados, total } = await generarQrFaltantes()
      setAviso(creados === 0
        ? `Los ${total} electores ya tienen su QR.`
        : `${creados} QR creados. Ahora los ${total} electores tienen el suyo.`)
      if (creados > 0) {
        const d = await fetch('/api/core/qr').then((r) => r.json())
        setQrs(d.qrs ?? [])
      }
    })
  }

  function handleToggle(qrId: string) {
    startTransition(async () => {
      const res = await toggleQR(qrId, tenantId)
      if (res.success) {
        setQrs(prev => prev.map(q => q.id === qrId ? { ...q, isActive: res.isActive! } : q))
        if (qrActivo?.id === qrId) setQrActivo(null)
      }
    })
  }

  const liderNombre = (id: string) => lideres.find(l => l.id === id)?.name ?? id

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>QR de captación</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleGenerarFaltantes}
            disabled={isPending}
            title="Cada elector tiene su propio QR desde que se crea. Esto se lo genera a los que entraron por fuera de la app."
            style={{
              background: '#f1f5f9', color: '#0f172a', padding: '0.5rem 1rem',
              borderRadius: '6px', border: '1px solid #e2e8f0', cursor: isPending ? 'wait' : 'pointer',
              fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            {isPending ? 'Generando…' : 'Generar los que faltan'}
          </button>
          <button
            onClick={() => setModalAbierto(true)}
            style={{
              background: '#0f172a', color: '#fff', padding: '0.5rem 1rem',
              borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            + Generar QR
          </button>
        </div>
      </div>

      {aviso && (
        <div style={{ padding: '0.75rem', background: '#dcfce7', color: '#166534', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {aviso}
        </div>
      )}

      {error && (
        <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* QR activo para mostrar/descargar */}
      {qrActivo && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <QrImage url={construirUrl(qrActivo.token)} size={200} label={liderNombre(qrActivo.leaderId)} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>QR generado</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>Líder: {liderNombre(qrActivo.leaderId)}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem', wordBreak: 'break-all' }}>
              URL: {construirUrl(qrActivo.token)}
            </div>
            <button onClick={() => setQrActivo(null)} style={{ background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.3rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Tabla de QR */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        {qrs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            No hay QR generados todavía. Crea el primero con el botón de arriba.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <Th>Líder</Th>
                <Th>Registros</Th>
                <Th>Estado</Th>
                <Th>Vencimiento</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {qrs.map((qr) => (
                <tr key={qr.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <Td>{liderNombre(qr.leaderId)}</Td>
                  <Td>{qr.registrationsCount}</Td>
                  <Td>
                    <span style={{
                      background:   qr.isActive ? '#dcfce7' : '#fee2e2',
                      color:        qr.isActive ? '#166534' : '#991b1b',
                      padding:      '0.15rem 0.5rem',
                      borderRadius: '999px',
                      fontSize:     '0.75rem',
                      fontWeight:   600,
                    }}>
                      {qr.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </Td>
                  <Td>
                    {qr.expiresAt
                      ? new Date(qr.expiresAt).toLocaleDateString('es-CO')
                      : <span style={{ color: '#94a3b8' }}>Sin vencimiento</span>}
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {qr.isActive && (
                        <button
                          onClick={() => setQrActivo(qr)}
                          style={{ background: '#dbeafe', color: '#1e40af', border: 'none', padding: '0.25rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          Ver QR
                        </button>
                      )}
                      <button
                        onClick={() => handleToggle(qr.id)}
                        disabled={isPending}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${qr.isActive ? '#ef4444' : '#22c55e'}`,
                          color:  qr.isActive ? '#ef4444' : '#22c55e',
                          padding: '0.25rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem',
                        }}
                      >
                        {qr.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal generar QR */}
      {modalAbierto && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '380px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Generar QR de captación</h2>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
              Seleccionar líder *
            </label>
            <select
              value={liderSel}
              onChange={e => setLiderSel(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem', background: '#fff', marginBottom: '1rem' }}
            >
              <option value="">— Seleccionar líder —</option>
              {lideres.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleGenerar} disabled={!liderSel || isPending}
                style={{
                  background: (!liderSel || isPending) ? '#94a3b8' : '#0f172a', color: '#fff',
                  padding: '0.625rem 1.25rem', borderRadius: '6px', border: 'none',
                  cursor: (!liderSel || isPending) ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600,
                }}
              >
                {isPending ? 'Generando...' : 'Generar'}
              </button>
              <button
                onClick={() => { setModalAbierto(false); setLiderSel('') }}
                style={{ background: 'transparent', color: '#64748b', padding: '0.625rem 1.25rem', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{children}</th>
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.875rem', verticalAlign: 'middle' }}>{children}</td>
}
