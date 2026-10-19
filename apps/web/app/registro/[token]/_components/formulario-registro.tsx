'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { registrarseConQR, type RegistroQRInput } from '../actions'
import { getEncuestaPendiente } from '@/app/(tenant)/pwa/encuestas/actions'
import { IconCheckCircle, IconWhatsapp, IconCopy, IconCheck } from '@/app/_components/icons'

interface Puesto {
  id:     string
  name:   string
  tables: { id: string; number: number }[]
}

interface FormularioRegistroProps {
  slug:    string
  token:   string
  refId?:  string
  puestos: Puesto[]
}

export function FormularioRegistro({ slug, token, refId, puestos }: FormularioRegistroProps) {
  const [nombre,    setNombre]    = useState('')
  const [apodo,     setApodo]     = useState('')
  const [cedula,    setCedula]    = useState('')
  const [telefono,  setTelefono]  = useState('')
  const [direccion, setDireccion] = useState('')
  const [puestoId,  setPuestoId]  = useState('')
  const [mesaId,    setMesaId]    = useState('')
  const [mensaje,   setMensaje]   = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [enviado,   setEnviado]   = useState(false)
  const [miQrToken, setMiQrToken] = useState<string | null>(null)
  const [copiado,   setCopiado]   = useState(false)
  // Encuesta pendiente justo tras registrarse — solo si quedó logueado (requiere teléfono).
  const [preguntasEncuesta, setPreguntasEncuesta] = useState<number | null>(null)

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const mesasDelPuesto = puestos.find((p) => p.id === puestoId)?.tables ?? []

  function ingresarOtro() {
    setNombre(''); setApodo(''); setCedula(''); setTelefono(''); setDireccion('')
    setPuestoId(''); setMesaId('')
    setMensaje(null); setEnviado(false); setMiQrToken(null); setCopiado(false); setPreguntasEncuesta(null)
    window.scrollTo({ top: 0 })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMensaje(null)

    const input: RegistroQRInput = {
      nombre:    nombre.trim(),
      apodo:     apodo.trim() || undefined,
      cedula:    cedula.trim(),
      telefono:  telefono.trim() || undefined,
      direccion: direccion.trim() || undefined,
      puestoId:  puestoId || undefined,
      mesaId:    mesaId   || undefined,
    }

    startTransition(async () => {
      const res = await registrarseConQR(slug, token, input, refId)
      if (res.success) {
        setMensaje({ tipo: 'ok', texto: res.message })
        setEnviado(true)
        if (res.qrToken) setMiQrToken(res.qrToken)

        // Si dejó teléfono, lo logueamos de una vez (mismas credenciales que
        // el login de elector) para que pueda responder la encuesta sin dar
        // otro paso — "contestarla de una vez" tal como se registra.
        if (input.telefono) {
          const auth = await signIn('elector', { slug, cedula: input.cedula, telefono: input.telefono, redirect: false })
          if (!auth?.error) {
            const pendientes = await getEncuestaPendiente()
            setPreguntasEncuesta(pendientes.length)
          }
        }
      } else {
        setMensaje({ tipo: 'error', texto: res.error })
      }
    })
  }

  // Pantalla de éxito — ya no se puede enviar de nuevo
  if (enviado && mensaje?.tipo === 'ok') {
    // Su propio QR (no el que usó para registrarse) — quien se registre con
    // este link queda bajo él en la jerarquía, no bajo quien lo invitó a él.
    const linkReferido = miQrToken
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/registro/${miQrToken}?c=${slug}`
      : null

    // Mensaje personalizado con el nombre/apodo de quien invita — en Colombia
    // es normal llamarse por apodo, hace el mensaje más cercano que un link pelado.
    const comoLoLlaman = apodo.trim() || nombre.trim()
    const mensajeInvitacion = linkReferido
      ? `¡Hola! Soy ${comoLoLlaman} 👋 Te invito a que te registres, es rápido: ${linkReferido}`
      : null

    async function copiarMensaje() {
      if (!mensajeInvitacion) return
      try {
        await navigator.clipboard.writeText(mensajeInvitacion)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2500)
      } catch {
        // Fallback para navegadores sin soporte de clipboard API
        const el = document.createElement('input')
        el.value = mensajeInvitacion
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2500)
      }
    }

    return (
      <div
        style={{
          background:   '#fff',
          borderRadius: '12px',
          border:       '1px solid #e2e8f0',
          padding:      '2rem',
          textAlign:    'center',
        }}
      >
        <div style={{ color: '#16a34a', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
          <IconCheckCircle size={48} />
        </div>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: '#166534', margin: '0 0 1.5rem' }}>
          {mensaje.texto}
        </p>

        {!!preguntasEncuesta && (
          <button
            onClick={() => router.push('/pwa/encuestas')}
            style={{
              display: 'block', width: '100%', boxSizing: 'border-box',
              background: '#4338ca', color: '#fff', border: 'none', borderRadius: '10px',
              padding: '0.875rem 1rem', fontSize: '0.95rem', fontWeight: 700,
              cursor: 'pointer', marginBottom: '1.25rem',
            }}
          >
            Responder encuesta ahora ({preguntasEncuesta} pregunta{preguntasEncuesta === 1 ? '' : 's'}) →
          </button>
        )}

        {mensajeInvitacion && (
          <div
            style={{
              background:   '#f8fafc',
              border:       '1px solid #e2e8f0',
              borderRadius: '10px',
              padding:      '1.25rem',
              textAlign:    'left',
            }}
          >
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', margin: '0 0 0.75rem' }}>
              ¿Quieres invitar a tus conocidos? Este es tu mensaje:
            </p>
            <div
              style={{
                background:   '#fff',
                border:       '1px solid #cbd5e1',
                borderRadius: '8px',
                padding:      '0.6rem 0.75rem',
                fontSize:     '0.8rem',
                color:        '#374151',
                wordBreak:    'break-word',
                marginBottom: '0.75rem',
              }}
            >
              {mensajeInvitacion}
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensajeInvitacion)}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                gap:          '0.5rem',
                width:        '100%',
                boxSizing:    'border-box',
                background:   '#25D366',
                color:        '#fff',
                border:       'none',
                borderRadius: '8px',
                padding:      '0.75rem',
                fontSize:     '0.9rem',
                fontWeight:   700,
                textAlign:    'center',
                textDecoration: 'none',
                marginBottom: '0.5rem',
              }}
            >
              <IconWhatsapp size={18} /> Compartir por WhatsApp
            </a>
            <button
              onClick={copiarMensaje}
              style={{
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                gap:          '0.4rem',
                width:        '100%',
                background:   copiado ? '#dcfce7' : 'transparent',
                color:        copiado ? '#166534' : '#64748b',
                border:       `1px solid ${copiado ? '#bbf7d0' : '#e2e8f0'}`,
                borderRadius: '8px',
                padding:      '0.6rem',
                fontSize:     '0.85rem',
                fontWeight:   600,
                cursor:       'pointer',
                transition:   'all 0.2s',
              }}
            >
              {copiado ? <IconCheck size={14} /> : <IconCopy size={14} />}
              {copiado ? 'Copiado' : 'Copiar mensaje'}
            </button>
          </div>
        )}

        {telefono.trim() && (
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1.25rem' }}>
            <a href={`/electores/login?c=${slug}`} style={{ color: '#1e40af', fontWeight: 600, textDecoration: 'none' }}>
              Entra con tu cédula y tu teléfono →
            </a>
            {' '}para ver y compartir tu QR cuando quieras.
          </p>
        )}

        {/* Mismo link, formulario limpio: el siguiente queda en la red del mismo dueño del QR. */}
        <button
          type="button" onClick={ingresarOtro}
          style={{
            width: '100%', marginTop: '1.25rem', background: '#0f172a', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Ingresar otro
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        <Campo label="Nombre completo *">
          <input
            type="text" value={nombre} onChange={e => setNombre(e.target.value)}
            required placeholder="María García López" autoComplete="name"
            style={estiloInput}
          />
        </Campo>

        <Campo label="Apodo">
          <input
            type="text" value={apodo} onChange={e => setApodo(e.target.value)}
            placeholder="Como le dicen normalmente"
            style={estiloInput}
          />
        </Campo>

        <Campo label="Número de cédula *">
          <input
            type="number" value={cedula} onChange={e => setCedula(e.target.value)}
            required placeholder="1234567890" inputMode="numeric"
            style={estiloInput}
          />
        </Campo>

        <Campo label="Teléfono celular">
          <input
            type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
            placeholder="300 000 0000" inputMode="tel" autoComplete="tel"
            style={estiloInput}
          />
        </Campo>

        <Campo label="Dirección">
          <input
            type="text" value={direccion} onChange={e => setDireccion(e.target.value)}
            placeholder="Cra 45 #23-10, Barrio Laureles" autoComplete="street-address"
            style={estiloInput}
          />
        </Campo>

        {puestos.length > 0 && (
          <Campo label="Puesto de votación">
            <select
              value={puestoId}
              onChange={e => { setPuestoId(e.target.value); setMesaId('') }}
              style={{ ...estiloInput, background: '#fff' }}
            >
              <option value="">— Seleccionar puesto —</option>
              {puestos.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Campo>
        )}

        {mesasDelPuesto.length > 0 && (
          <Campo label="Mesa">
            <select
              value={mesaId}
              onChange={e => setMesaId(e.target.value)}
              style={{ ...estiloInput, background: '#fff' }}
            >
              <option value="">— Seleccionar mesa —</option>
              {mesasDelPuesto.map((m) => (
                <option key={m.id} value={m.id}>Mesa {m.number}</option>
              ))}
            </select>
          </Campo>
        )}

        {mensaje && (
          <div style={{
            padding: '0.75rem 1rem', borderRadius: '8px',
            background: mensaje.tipo === 'ok' ? '#dcfce7' : '#fee2e2',
            color:      mensaje.tipo === 'ok' ? '#166534' : '#991b1b',
            fontSize: '0.875rem',
          }}>
            {mensaje.texto}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          style={{
            background:   isPending ? '#94a3b8' : '#0f172a',
            color:        '#fff',
            padding:      '0.875rem 1rem',
            borderRadius: '10px',
            border:       'none',
            cursor:       isPending ? 'not-allowed' : 'pointer',
            fontSize:     '1rem',
            fontWeight:   700,
            marginTop:    '0.5rem',
          }}
        >
          {isPending ? 'Registrando...' : 'Registrarme'}
        </button>

      </form>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.25rem' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const estiloInput: React.CSSProperties = {
  width:        '100%',
  padding:      '0.75rem',
  border:       '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize:     '1rem',   // Grande para móvil
  outline:      'none',
  boxSizing:    'border-box',
}
