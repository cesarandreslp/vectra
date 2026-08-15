'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateFinanceConfig } from '../../actions'
import type { FinanceConfigView } from '../../actions'

interface FinanceConfigFormProps {
  initialConfig: FinanceConfigView | null
  electores:     { id: string; name: string }[]
}

export function FinanceConfigForm({ initialConfig, electores }: FinanceConfigFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setSuccess(false)
    setError(null)

    const fd = new FormData(e.currentTarget)
    try {
      await updateFinanceConfig({
        topeGastos:         fd.get('topeGastos') ? Number(fd.get('topeGastos')) : undefined,
        fechaInicioCampana: (fd.get('fechaInicioCampana') as string) || undefined,
        fechaFinCampana:    (fd.get('fechaFinCampana') as string) || undefined,
        tesoreroId:         (fd.get('tesoreroId') as string) || null,
        cuentaBancaria:     (fd.get('cuentaBancaria') as string) || undefined,
      })
      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar configuración')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '0.75rem', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontSize: '0.85rem' }}>
          Configuración guardada correctamente.
        </div>
      )}

      <label style={labelStyle}>
        Tope legal de gastos (COP)
        <input
          name="topeGastos"
          type="number"
          min="0"
          step="1"
          defaultValue={initialConfig?.topeGastos ?? ''}
          style={inputStyle}
          placeholder="Monto en pesos colombianos"
        />
      </label>

      {/* Nota informativa */}
      <div style={{
        padding: '0.75rem', background: '#f0f9ff', border: '1px solid #bae6fd',
        borderRadius: '8px', fontSize: '0.8rem', color: '#0c4a6e',
      }}>
        Los topes de gastos de campaña son definidos por el Consejo Nacional Electoral (CNE) según
        el tipo de cargo y la circunscripción. Consulte la Resolución vigente del CNE para el valor
        actualizado del tope aplicable a su campaña.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <label style={labelStyle}>
          Fecha inicio de campaña
          <input
            name="fechaInicioCampana"
            type="date"
            defaultValue={initialConfig?.fechaInicioCampana ? new Date(initialConfig.fechaInicioCampana).toISOString().split('T')[0] : ''}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Fecha fin de campaña
          <input
            name="fechaFinCampana"
            type="date"
            defaultValue={initialConfig?.fechaFinCampana ? new Date(initialConfig.fechaFinCampana).toISOString().split('T')[0] : ''}
            style={inputStyle}
          />
        </label>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

      <label style={labelStyle}>
        Tesorero
        <select name="tesoreroId" defaultValue={initialConfig?.tesoreroId ?? ''} style={inputStyle}>
          <option value="">Sin asignar</option>
          {electores.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
          El tesorero es una persona del padrón. Su nombre y cédula para el informe salen
          de su ficha de elector. Si no está en la lista, agrégalo primero en Electores.
        </span>
      </label>

      <label style={labelStyle}>
        Cuenta bancaria
        <input
          name="cuentaBancaria"
          style={inputStyle}
          placeholder={initialConfig?.hasCuentaBancaria ? '••••••••• (ya registrada)' : 'Número de cuenta'}
        />
        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
          Se cifra al guardar. Deje en blanco para no modificar.
        </span>
      </label>

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '0.7rem 2rem', fontSize: '0.9rem', borderRadius: '6px',
          border: 'none', background: '#1e40af', color: '#fff',
          cursor: loading ? 'wait' : 'pointer', fontWeight: 600,
          alignSelf: 'flex-start', marginTop: '0.5rem',
        }}
      >
        {loading ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </form>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '0.25rem',
  fontSize: '0.85rem', fontWeight: 500, color: '#334155',
}
const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', borderRadius: '6px',
  border: '1px solid #cbd5e1', fontSize: '0.9rem',
}
