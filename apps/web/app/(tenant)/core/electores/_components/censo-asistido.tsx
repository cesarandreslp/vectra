'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { datosConsultaAsistida, guardarCensoRegistraduria } from '../../actions-censo'
import { CONSULTA_OFICIAL, type EstadoRegistraduria, type PuestoConocido } from '@/lib/censo-registraduria'
import { Campo, Selector, Texto, estiloInput } from './campo-formulario'

const RESULTADOS = [
  { value: 'ENCONTRADO',    label: 'Aparece con puesto y mesa' },
  { value: 'NO_ENCONTRADO', label: 'No está inscrito' },
  { value: 'NOVEDAD',       label: 'Tiene novedad' },
]

const boton: React.CSSProperties = {
  background: '#f1f5f9', color: '#475569', padding: '0.5rem 1rem', borderRadius: '6px',
  fontSize: '0.875rem', border: '1px solid #e2e8f0', cursor: 'pointer',
}

/**
 * Consulta asistida: copia la cédula, abre la página oficial en otra pestaña y
 * registra lo que la persona vio allí. Ver lib/censo-registraduria.ts.
 */
export function ConsultaAsistida({ voterId }: { voterId: string }) {
  const router = useRouter()
  const [datos, setDatos]     = useState<{ cedula: string; puestos: PuestoConocido[] } | null>(null)
  const [estado, setEstado]   = useState<EstadoRegistraduria>('ENCONTRADO')
  const [puesto, setPuesto]   = useState('')
  const [mesa, setMesa]       = useState('')
  const [municipio, setMunicipio]       = useState('')
  const [departamento, setDepartamento] = useState('')
  const [direccion, setDireccion] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [aviso, setAviso]     = useState<string | null>(null)
  const [enCurso, startTransition] = useTransition()

  function abrir() {
    startTransition(async () => {
      const d = await datosConsultaAsistida(voterId)
      if (!d) return setAviso('Elector no encontrado.')
      setDatos(d)
      // El municipio más común entre los puestos de la campaña sirve de valor inicial.
      const veces = new Map<string, number>()
      for (const p of d.puestos) veces.set(p.municipio, (veces.get(p.municipio) ?? 0) + 1)
      const base = d.puestos.reduce<PuestoConocido | null>(
        (m, p) => (!m || veces.get(p.municipio)! > veces.get(m.municipio)! ? p : m), null)
      setMunicipio(base?.municipio ?? ''); setDepartamento(base?.departamento ?? '')
    })
  }

  // Síncrono dentro del clic: el portapapeles y la pestaña nueva exigen gesto del usuario.
  function irARegistraduria() {
    if (datos) navigator.clipboard?.writeText(datos.cedula).catch(() => {})
    window.open(CONSULTA_OFICIAL, '_blank', 'noopener')
  }

  function elegirPuesto(nombre: string) {
    setPuesto(nombre)
    const p = datos?.puestos.find((x) => x.nombre === nombre)
    if (p) { setMunicipio(p.municipio); setDepartamento(p.departamento) }
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    setAviso(null)
    const lugar: Record<string, string> = estado === 'ENCONTRADO'
      ? { estado: 'encontrado', puesto, mesa, municipio, departamento, direccion }
      : { estado: estado === 'NOVEDAD' ? 'novedad' : 'no_encontrado', mensaje }
    startTransition(async () => {
      const r = await guardarCensoRegistraduria(voterId, { estado, lugar })
      if (!r.success) return setAviso(r.error ?? 'No se pudo guardar.')
      setDatos(null)
      router.refresh()
    })
  }

  if (!datos) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button type="button" onClick={abrir} disabled={enCurso} style={boton}>
          {enCurso ? 'Cargando…' : 'Verificar dónde vota'}
        </button>
        {aviso && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{aviso}</span>}
      </div>
    )
  }

  return (
    <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
      <div style={{ fontSize: '0.85rem', color: '#475569' }}>
        1. Copia la cédula <strong>{datos.cedula}</strong> y consúltala en la página oficial.
      </div>
      <button type="button" onClick={irARegistraduria} style={{ ...boton, alignSelf: 'flex-start' }}>
        Copiar cédula y abrir Registraduría ↗
      </button>
      <div style={{ fontSize: '0.85rem', color: '#475569' }}>2. Registra lo que muestra:</div>
      <Selector label="Resultado" value={estado} onChange={(v) => setEstado(v as EstadoRegistraduria)} opciones={RESULTADOS} />
      {estado === 'ENCONTRADO' ? (
        <>
          <Campo label="Puesto *">
            <input list={`puestos-${voterId}`} value={puesto} onChange={(e) => elegirPuesto(e.target.value)} required style={estiloInput} placeholder="Escribe o elige de la lista" />
            <datalist id={`puestos-${voterId}`}>
              {datos.puestos.map((p) => <option key={`${p.nombre}-${p.municipio}`} value={p.nombre}>{p.municipio}</option>)}
            </datalist>
          </Campo>
          <Texto label="Mesa *" value={mesa} onChange={(v) => setMesa(v.replace(/\D/g, ''))} required placeholder="Ej. 7" />
          <Texto label="Municipio" value={municipio} onChange={setMunicipio} />
          <Texto label="Departamento" value={departamento} onChange={setDepartamento} />
          <Texto label="Dirección del puesto" value={direccion} onChange={setDireccion} />
        </>
      ) : (
        <Texto label="Mensaje de la Registraduría" value={mensaje} onChange={setMensaje} placeholder="Lo que dice la página (opcional)" />
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" disabled={enCurso} style={{ ...boton, background: '#1e40af', color: '#fff', border: 'none' }}>
          {enCurso ? 'Guardando…' : 'Guardar resultado'}
        </button>
        <button type="button" onClick={() => setDatos(null)} style={{ ...boton, background: 'transparent' }}>Cancelar</button>
        {aviso && <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>{aviso}</span>}
      </div>
    </form>
  )
}
