'use client'

import { useState, useTransition } from 'react'
import { atenderSolicitud } from '../actions'

type Accion = 'NINGUNA' | 'REVOCAR' | 'SUPRIMIR'

const CONFIRMA: Record<Exclude<Accion, 'NINGUNA'>, string> = {
  REVOCAR:  '¿Confirmas que verificaste que es el titular? Se retira su autorización: queda "sin autorización" y no se le enviará nada.',
  SUPRIMIR: '¿Confirmas que verificaste que es el titular? Se borran su nombre, cédula, celular, dirección, perfil, conversaciones y respuestas. No se puede deshacer.',
}

export function AtenderSolicitud({ id, tipo, hayElector }: { id: string; tipo: string; hayElector: boolean }) {
  const [respuesta, setRespuesta] = useState('')
  const [error, setError] = useState('')
  const [pendiente, iniciar] = useTransition()

  const correr = (accion: Accion) => {
    if (accion !== 'NINGUNA' && !window.confirm(CONFIRMA[accion])) return
    iniciar(async () => {
      setError('')
      const r = await atenderSolicitud(id, respuesta, accion)
      if (!r.success) setError(r.error)
    })
  }

  const boton = (texto: string, accion: Accion, peligro = false) => (
    <button
      type="button" disabled={pendiente || !respuesta.trim()} onClick={() => correr(accion)}
      style={{
        border: peligro ? 'none' : '1px solid #cbd5e1', background: peligro ? '#b91c1c' : '#fff', color: peligro ? '#fff' : '#334155',
        borderRadius: 6, padding: '0.45rem 0.85rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
        opacity: pendiente || !respuesta.trim() ? 0.5 : 1,
      }}
    >
      {texto}
    </button>
  )

  return (
    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <textarea
        rows={2} value={respuesta} onChange={(e) => setRespuesta(e.target.value)}
        placeholder="Qué se le respondió al titular, y por dónde (queda como constancia)"
        style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '0.5rem', fontSize: '0.85rem', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {boton('Marcar respondida', 'NINGUNA')}
        {hayElector && (tipo === 'REVOCACION' || tipo === 'SUPRESION') && boton('Revocar autorización y cerrar', 'REVOCAR')}
        {hayElector && tipo === 'SUPRESION' && boton('Suprimir sus datos y cerrar', 'SUPRIMIR', true)}
      </div>
      {tipo === 'CORRECCION' && hayElector && (
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Corrige los datos desde su ficha (Editar) y luego marca la solicitud como respondida.</p>
      )}
      {error && <p style={{ margin: 0, fontSize: '0.8rem', color: '#b91c1c' }}>{error}</p>}
    </div>
  )
}
