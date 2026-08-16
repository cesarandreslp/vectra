'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSurveyCampaign } from '../../../actions'

type TipoPregunta = 'FREE_TEXT' | 'PARAGRAPH' | 'BOOLEAN' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'DROPDOWN' | 'SCALE'

/** Tipos que llevan opciones propias (radio / checkbox / desplegable). */
const CON_OPCIONES: TipoPregunta[] = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DROPDOWN']

const TIPOS: { value: TipoPregunta; label: string }[] = [
  { value: 'SINGLE_CHOICE',   label: 'Opción única' },
  { value: 'MULTIPLE_CHOICE', label: 'Opción múltiple (varias)' },
  { value: 'DROPDOWN',        label: 'Desplegable' },
  { value: 'SCALE',           label: 'Escala' },
  { value: 'BOOLEAN',         label: 'Sí / No' },
  { value: 'PARAGRAPH',       label: 'Párrafo (texto largo)' },
  { value: 'FREE_TEXT',       label: 'Abierta — identifica candidato con IA' },
]

interface PreguntaForm {
  text: string
  type: TipoPregunta
  opciones: string[]
  scaleMin: number
  scaleMax: number
}

const PREGUNTA_VACIA: PreguntaForm = { text: '', type: 'SINGLE_CHOICE', opciones: ['', ''], scaleMin: 1, scaleMax: 5 }

export function NewCampaignForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [fecha, setFecha] = useState('')
  const [seccion, setSeccion] = useState('General')
  const [preguntas, setPreguntas] = useState<PreguntaForm[]>([{ ...PREGUNTA_VACIA }])
  const [candidatos, setCandidatos] = useState([{ name: '', code: '' }])

  // Los candidatos solo sirven para las preguntas "abiertas" (matcher IA). Si no
  // hay ninguna, la encuesta es general y no se piden candidatos.
  const hayAI = preguntas.some(p => p.type === 'FREE_TEXT')

  const addCandidato = () => setCandidatos([...candidatos, { name: '', code: '' }])
  const updateCandidato = (i: number, field: 'name' | 'code', value: string) => {
    const next = [...candidatos]; next[i] = { ...next[i], [field]: value }; setCandidatos(next)
  }

  const addPregunta = () => setPreguntas([...preguntas, { ...PREGUNTA_VACIA }])
  const removePregunta = (i: number) => setPreguntas(preguntas.filter((_, idx) => idx !== i))
  const updatePregunta = (i: number, campo: Partial<PreguntaForm>) => {
    const next = [...preguntas]; next[i] = { ...next[i], ...campo }; setPreguntas(next)
  }
  const updateOpcion = (i: number, oi: number, value: string) => {
    const next = [...preguntas]; const ops = [...next[i].opciones]; ops[oi] = value
    next[i] = { ...next[i], opciones: ops }; setPreguntas(next)
  }
  const addOpcion = (i: number) => updatePregunta(i, { opciones: [...preguntas[i].opciones, ''] })
  const removeOpcion = (i: number, oi: number) => updatePregunta(i, { opciones: preguntas[i].opciones.filter((_, idx) => idx !== oi) })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    const payload = {
      name,
      electionDate: new Date(fecha),
      cargos: [{
        name: seccion.trim() || 'General',
        order: 1,
        preguntas: preguntas
          .filter(p => p.text.trim() !== '')
          .map((p, i) => ({
            text: p.text, order: i + 1, type: p.type,
            opciones: CON_OPCIONES.includes(p.type) ? p.opciones.filter(o => o.trim() !== '') : undefined,
            scaleMin: p.type === 'SCALE' ? p.scaleMin : undefined,
            scaleMax: p.type === 'SCALE' ? p.scaleMax : undefined,
          })),
        // Solo se mandan si hay una pregunta abierta que los use.
        candidatos: hayAI ? candidatos.filter(c => c.name.trim() !== '') : [],
      }],
    }

    const res = await createSurveyCampaign(payload)
    if (res.success) router.push('/encuestas/campanas')
    else { setError(res.error || 'Error al guardar'); setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Nombre de la encuesta</label>
          <input value={name} onChange={e => setName(e.target.value)} required className="w-full border rounded px-3 py-2" placeholder="Ej. Percepción de servicios 2026" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className="w-full border rounded px-3 py-2" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Sección</label>
        <input value={seccion} onChange={e => setSeccion(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="General" />
        <p className="text-xs text-slate-500 mt-1">Agrupa las preguntas. Para una encuesta electoral, ponle el nombre del cargo (ej. Alcaldía).</p>
      </div>

      <hr />

      <div>
        <h3 className="text-lg font-bold mb-2">Preguntas</h3>
        <div className="space-y-4">
          {preguntas.map((p, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <input value={p.text} onChange={e => updatePregunta(i, { text: e.target.value })} placeholder="Texto de la pregunta" required className="flex-1 border rounded px-3 py-2 text-sm" />
                <select value={p.type} onChange={e => updatePregunta(i, { type: e.target.value as TipoPregunta })} className="border rounded px-2 py-2 text-sm">
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {preguntas.length > 1 && (
                  <button type="button" onClick={() => removePregunta(i)} className="text-red-500 text-sm px-2">✕</button>
                )}
              </div>

              {p.type === 'FREE_TEXT' && (
                <p className="text-xs text-slate-500">La IA identifica al candidato entre los de abajo, incluso por apodo o número de tarjetón.</p>
              )}
              {p.type === 'PARAGRAPH' && (
                <p className="text-xs text-slate-500">Texto libre largo. No se procesa con IA.</p>
              )}

              {CON_OPCIONES.includes(p.type) && (
                <div className="space-y-1 pl-1">
                  {p.opciones.map((o, oi) => (
                    <div key={oi} className="flex gap-2">
                      <input value={o} onChange={e => updateOpcion(i, oi, e.target.value)} placeholder={`Opción ${oi + 1}`} className="flex-1 border rounded px-3 py-1.5 text-sm" />
                      {p.opciones.length > 2 && (
                        <button type="button" onClick={() => removeOpcion(i, oi)} className="text-red-500 text-sm px-2">✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => addOpcion(i)} className="text-granate text-xs font-semibold hover:underline">+ Añadir opción</button>
                </div>
              )}

              {p.type === 'SCALE' && (
                <div className="flex items-center gap-2 text-sm pl-1">
                  <span className="text-slate-500 text-xs">Escala del</span>
                  <input type="number" value={p.scaleMin} onChange={e => updatePregunta(i, { scaleMin: Number(e.target.value) })} className="w-16 border rounded px-2 py-1" />
                  <span className="text-slate-500 text-xs">al</span>
                  <input type="number" value={p.scaleMax} onChange={e => updatePregunta(i, { scaleMax: Number(e.target.value) })} className="w-16 border rounded px-2 py-1" />
                </div>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addPregunta} className="mt-2 text-granate text-sm font-semibold hover:underline">+ Añadir pregunta</button>
      </div>

      {/* Candidatos: solo cuando hay una pregunta abierta que los use. */}
      {hayAI && (
        <div>
          <h4 className="font-bold mb-2">Candidatos oficiales</h4>
          <p className="text-xs text-slate-500 mb-2">Para identificar las respuestas de las preguntas abiertas.</p>
          {candidatos.map((c, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={c.name} onChange={e => updateCandidato(i, 'name', e.target.value)} placeholder="Nombre del candidato" className="flex-1 border rounded px-3 py-2 text-sm" />
              <input value={c.code} onChange={e => updateCandidato(i, 'code', e.target.value)} placeholder="Código (ej. U10)" className="w-32 border rounded px-3 py-2 text-sm" />
            </div>
          ))}
          <button type="button" onClick={addCandidato} className="text-granate text-sm font-semibold hover:underline">+ Añadir candidato</button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm font-semibold bg-red-50 p-3 rounded">{error}</div>}

      <div className="pt-4 flex justify-end">
        <button type="submit" disabled={loading} className="bg-slate-900 text-white px-6 py-2 rounded-md font-semibold hover:bg-slate-800 disabled:opacity-50">
          {loading ? 'Guardando...' : 'Crear encuesta'}
        </button>
      </div>
    </form>
  )
}
