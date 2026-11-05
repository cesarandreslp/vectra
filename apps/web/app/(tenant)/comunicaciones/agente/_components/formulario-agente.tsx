'use client'

import { useState, useTransition } from 'react'
import { guardarAgente, type TextosAgente, type VistaAgente } from '../actions'

const CAMPOS: { clave: keyof TextosAgente; titulo: string; ayuda: string; filas: number }[] = [
  { clave: 'propuestas', titulo: 'Propuestas', filas: 10,
    ayuda: 'Lo único de lo que el agente puede hablar sobre el programa. Lo que no esté acá, dice que no lo sabe y escala.' },
  { clave: 'biografia', titulo: 'Biografía del candidato', filas: 6, ayuda: 'Trayectoria, origen, logros.' },
  { clave: 'tono', titulo: 'Tono', filas: 2, ayuda: 'Ej.: cercano, de tú, sin tecnicismos, con humor suave.' },
  { clave: 'lineamientos', titulo: 'Lineamientos', filas: 5,
    ayuda: 'Qué no decir, temas vedados, cómo responder a ataques. El agente nunca ofrece nada a cambio del voto ni ataca a otros candidatos.' },
  { clave: 'textoAutorizacion', titulo: 'Texto de autorización de datos (Ley 1581)', filas: 4,
    ayuda: 'El agente lo pide antes de anotar cualquier dato. Debe decir quién es el responsable, para qué se usan los datos y que dar datos sensibles no es obligatorio. Que lo revise su asesor legal.' },
]

export function FormularioAgente({ vista }: { vista: VistaAgente }) {
  const [textos, setTextos] = useState<TextosAgente>(vista.textos)
  const [userIds, setUserIds] = useState<string[]>(vista.escalamientoUserIds)
  const [horario, setHorario] = useState(vista.escalamientoHorario)
  const [mensaje, setMensaje] = useState('')
  const [pendiente, iniciar] = useTransition()

  const guardar = () =>
    iniciar(async () => {
      setMensaje('')
      const r = await guardarAgente(textos, { userIds, horario })
      setMensaje(r.success ? 'Guardado. Recuerda aprobarlo para que el agente lo use.' : r.error)
    })

  const alternar = (id: string) => setUserIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]))

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      {CAMPOS.map((c) => (
        <label key={c.clave} className="block">
          <span className="block text-sm font-semibold text-slate-800">{c.titulo}</span>
          <span className="block text-xs text-slate-500 mb-1">{c.ayuda}</span>
          <textarea
            rows={c.filas} value={textos[c.clave]}
            onChange={(e) => setTextos((t) => ({ ...t, [c.clave]: e.target.value }))}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </label>
      ))}

      <fieldset className="border border-slate-200 rounded-lg p-4">
        <legend className="text-sm font-semibold text-slate-800 px-1">A quién avisa cuando escala</legend>
        <p className="text-xs text-slate-500 mt-0 mb-2">
          Les llega una alerta con el enlace a la conversación. El agente no se calla: el equipo atiende en paralelo.
          Si no eligen a nadie, avisa a los administradores.
        </p>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {vista.usuarios.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={userIds.includes(u.id)} onChange={() => alternar(u.id)} />
              {u.nombre}
            </label>
          ))}
        </div>
        <input
          value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Horario de atención, ej.: lunes a sábado, 8 a. m. a 8 p. m."
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-3"
        />
      </fieldset>

      <button
        type="button" onClick={guardar} disabled={pendiente}
        className="w-full bg-granate text-white font-semibold py-2 rounded-md disabled:opacity-50"
      >
        {pendiente ? 'Guardando…' : 'Guardar'}
      </button>
      {mensaje && <p className="text-sm text-center text-slate-700 m-0">{mensaje}</p>}
    </section>
  )
}
