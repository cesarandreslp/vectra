'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createVoter, updateVoter, listVoterOptions, listVotingStations,
  type CreateVoterInput, type CommitmentStatus, type StationOption, type VoterEditable,
} from '../../actions'
import { Selector, Texto } from './campo-formulario'

interface FormularioElectorProps {
  /** Con elector: edita ese. Sin él: crea uno nuevo. */
  elector?:        VoterEditable
  leaderIdInicial?: string
}

export function FormularioElector({ elector, leaderIdInicial = '' }: FormularioElectorProps) {
  const [cedula,    setCedula]    = useState(elector?.cedula ?? '')
  const [nombre,    setNombre]    = useState(elector?.name ?? '')
  const [apodo,     setApodo]     = useState(elector?.apodo ?? '')
  const [telefono,  setTelefono]  = useState(elector?.phone ?? '')
  const [direccion, setDireccion] = useState(elector?.address ?? '')
  const [leaderId,  setLeaderId]  = useState(elector?.leaderId ?? leaderIdInicial)
  const [estado,    setEstado]    = useState<CommitmentStatus>(elector?.commitmentStatus ?? 'SIN_CONTACTAR')
  const [puestoId,  setPuestoId]  = useState(elector?.stationId ?? '')
  const [mesaId,    setMesaId]    = useState(elector?.votingTableId ?? '')
  const [lideres,   setLideres]   = useState<{ id: string; name: string }[]>([])
  const [puestos,   setPuestos]   = useState<StationOption[]>([])
  const [error,     setError]     = useState<string | null>(null)
  const [exito,     setExito]     = useState(false)

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Cargar candidatos a "reporta a" (cualquier elector) y puestos de votación al montar.
  useEffect(() => {
    listVoterOptions().then((ls) => setLideres(ls.filter((l) => l.id !== elector?.id).map((l) => ({ id: l.id, name: l.name }))))
    listVotingStations().then(setPuestos)
  }, [elector?.id])
  const mesasDelPuesto = puestos.find((p) => p.id === puestoId)?.tables ?? []

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const input: CreateVoterInput = {
        cedula,
        name:             nombre,
        apodo:            apodo || undefined,
        phone:            telefono || undefined,
        address:          direccion || undefined,
        leaderId:         leaderId || undefined,
        votingTableId:    mesaId || undefined,
        commitmentStatus: estado,
      }

      if (elector) {
        const res = await updateVoter(elector.id, input)
        if (res.success) router.push(`/core/electores/${elector.id}`)
        else setError(res.error)
        return
      }

      const res = await createVoter(input)
      if (res.success) {
        setExito(true)
        // Limpiar para crear otro
        setCedula(''); setNombre(''); setApodo(''); setTelefono(''); setDireccion('')
        setLeaderId(leaderIdInicial); setEstado('SIN_CONTACTAR'); setPuestoId(''); setMesaId('')
        setTimeout(() => setExito(false), 3000)
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      <Texto label="Cédula *" value={cedula} onChange={setCedula} required placeholder="12345678"
        ayuda="Se cifra automáticamente — no se almacena en texto plano." />
      <Texto label="Nombre completo *" value={nombre} onChange={setNombre} required placeholder="María García López" />
      <Texto label="Apodo" value={apodo} onChange={setApodo} placeholder="Como le dicen normalmente (ej: Nacho, La Cucha)"
        ayuda="Se usa en el mensaje de invitación cuando comparte su QR — hace que sea más cercano." />
      <Texto label="Teléfono" type="tel" value={telefono} onChange={setTelefono} placeholder="300 000 0000" />
      <Texto label="Dirección" value={direccion} onChange={setDireccion} placeholder="Cra 45 #23-10, Barrio Laureles"
        ayuda="Se usa para ubicar al elector en el mapa del dashboard." />

      <Selector
        label="Reporta a (opcional)" value={leaderId} onChange={setLeaderId} vacio="— Nadie (electo directo) —"
        opciones={lideres.map((l) => ({ value: l.id, label: l.name }))}
      />

      <Selector
        label="Puesto de votación" value={puestoId} onChange={(v) => { setPuestoId(v); setMesaId('') }} vacio="— Sin puesto asignado —"
        opciones={puestos.map((p) => ({ value: p.id, label: p.name }))}
      />

      {mesasDelPuesto.length > 0 && (
        <Selector
          label="Mesa" value={mesaId} onChange={setMesaId} vacio="— Sin mesa asignada —"
          opciones={mesasDelPuesto.map((m) => ({ value: m.id, label: `Mesa ${m.number}` }))}
        />
      )}

      <Selector
        label={elector ? 'Estado' : 'Estado inicial'} value={estado} onChange={(v) => setEstado(v as CommitmentStatus)}
        opciones={ESTADOS}
      />

      {error && (
        <div style={{ padding: '0.625rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {exito && (
        <div style={{ padding: '0.625rem', background: '#dcfce7', color: '#166534', borderRadius: '6px', fontSize: '0.875rem' }}>
          Elector creado correctamente.
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button
          type="submit" disabled={isPending}
          style={{
            background: isPending ? '#94a3b8' : '#0f172a', color: '#fff',
            padding: '0.625rem 1.25rem', borderRadius: '6px', border: 'none',
            cursor: isPending ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 600,
          }}
        >
          {isPending ? 'Guardando...' : elector ? 'Guardar cambios' : 'Crear elector'}
        </button>
        <button
          type="button" onClick={() => router.push(elector ? `/core/electores/${elector.id}` : '/core/electores')}
          style={{
            background: 'transparent', color: '#64748b',
            padding: '0.625rem 1.25rem', borderRadius: '6px',
            border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.875rem',
          }}
        >
          {elector ? 'Cancelar' : 'Ver lista'}
        </button>
      </div>

    </form>
  )
}

const ESTADOS = [
  { value: 'SIN_CONTACTAR', label: 'Sin contactar' },
  { value: 'CONTACTADO',    label: 'Contactado' },
  { value: 'SIMPATIZANTE',  label: 'Simpatizante' },
  { value: 'COMPROMETIDO',  label: 'Comprometido' },
  { value: 'VOTO_SEGURO',   label: 'Voto seguro' },
]
