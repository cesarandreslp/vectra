'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { datosConsultaAsistida, guardarCensoRegistraduria } from '../../actions-censo'
import {
  CONSULTA_OFICIAL, leerResultadoPegado, puestoMasComun, sinTildes, type EstadoRegistraduria, type PuestoConocido,
} from '@/lib/censo-registraduria'
import { Campo, Selector, Texto, estiloInput } from './campo-formulario'
import { useResultadoExtension } from './censo-extension'

const RESULTADOS = [
  { value: 'ENCONTRADO',    label: 'Aparece con puesto y mesa' },
  { value: 'NO_ENCONTRADO', label: 'No está inscrito' },
  { value: 'NOVEDAD',       label: 'Tiene novedad' },
]

const paso: React.CSSProperties = { fontSize: '0.85rem', color: '#475569' }
const boton: React.CSSProperties = { background: '#f1f5f9', color: '#475569', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', border: '1px solid #e2e8f0', cursor: 'pointer' }

/**
 * Consulta asistida: copia la cédula, abre la página oficial en otra pestaña y
 * registra lo que la persona vio allí. Ver lib/censo-registraduria.ts.
 */
export function ConsultaAsistida({ voterId, onGuardado, autoAbrir }: { voterId: string; onGuardado?: () => void; autoAbrir?: boolean }) {
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

  useEffect(() => { if (autoAbrir) abrir() }, []) // eslint-disable-line react-hooks/exhaustive-deps  // cola: carga la cédula sola

  function abrir() {
    startTransition(async () => {
      const d = await datosConsultaAsistida(voterId)
      if (!d) return setAviso('Elector no encontrado.')
      setDatos(d)
      const base = puestoMasComun(d.puestos)
      setMunicipio(base?.municipio ?? ''); setDepartamento(base?.departamento ?? '')
    })
  }

  // Síncrono dentro del clic: el portapapeles y la pestaña nueva exigen gesto del usuario.
  function irARegistraduria() {
    if (datos) navigator.clipboard?.writeText(datos.cedula).catch(() => {})
    window.open(`${CONSULTA_OFICIAL}#vectra`, '_blank', 'noopener') // #vectra: la extensión solo actúa ahí
  }

  function elegirPuesto(nombre: string) {
    setPuesto(nombre)
    const p = datos?.puestos.find((x) => x.nombre === nombre)
    if (p) { setMunicipio(p.municipio); setDepartamento(p.departamento) }
  }

  /**
   * Resultado de la página oficial: pegado a mano (llena el formulario para
   * revisar) o entregado por la extensión (se guarda de una).
   */
  function recibir(texto: string, guardarYa: boolean) {
    const r = leerResultadoPegado(texto)
    if (!r) return setAviso('No se reconoce un resultado. Copia toda la página oficial (Ctrl+A, Ctrl+C) después de consultar.')
    if (r.nuip && datos && r.nuip !== datos.cedula.replace(/\D/g, '')) {
      return setAviso('El resultado es de otra cédula: consulta la de este elector.')
    }
    setAviso(null)
    const l = { ...r.resultado.lugar } as Record<string, string>
    // Si el puesto ya existe en la campaña se usan su nombre y municipio completos.
    const conocido = datos?.puestos.find((p) => sinTildes(p.nombre) === sinTildes(l.puesto ?? ''))
    if (conocido) Object.assign(l, { puesto: conocido.nombre, municipio: conocido.municipio, departamento: conocido.departamento })
    if (guardarYa) return enviar(r.resultado.estado, l)
    setEstado(r.resultado.estado); setMensaje(l.mensaje ?? '')
    setPuesto(l.puesto ?? ''); setMesa(l.mesa ?? ''); setDireccion(l.direccion ?? '')
    if (l.municipio) { setMunicipio(l.municipio); setDepartamento(l.departamento ?? '') }
  }
  useResultadoExtension(datos !== null, (texto) => recibir(texto, true))

  function enviar(est: EstadoRegistraduria, lugar: Record<string, string>) {
    startTransition(async () => {
      const r = await guardarCensoRegistraduria(voterId, { estado: est, lugar })
      if (!r.success) return setAviso(r.error ?? 'No se pudo guardar.')
      if (onGuardado) return onGuardado()
      setDatos(null)
      router.refresh()
    })
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    setAviso(null)
    enviar(estado, estado === 'ENCONTRADO'
      ? { estado: 'encontrado', puesto, mesa, municipio, departamento, direccion }
      : { estado: estado === 'NOVEDAD' ? 'novedad' : 'no_encontrado', mensaje })
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
      <div style={paso}>1. Copia la cédula <strong>{datos.cedula}</strong> y consúltala en la página oficial.</div>
      <button type="button" onClick={irARegistraduria} style={{ ...boton, alignSelf: 'flex-start' }}>
        Copiar cédula y abrir Registraduría ↗
      </button>
      <Campo label="2. Con la extensión llega solo. Sin ella: allá Ctrl+A, Ctrl+C; aquí Ctrl+V">
        <textarea rows={2} style={{ ...estiloInput, resize: 'vertical' }} placeholder="Pega aquí la página de la Registraduría y se llena solo"
          onPaste={(e) => { e.preventDefault(); recibir(e.clipboardData.getData('text'), false) }} />
      </Campo>
      <div style={paso}>3. Revisa y guarda (o escribe a mano si no pegaste):</div>
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
