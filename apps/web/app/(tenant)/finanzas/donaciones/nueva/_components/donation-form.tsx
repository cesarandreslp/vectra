'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createDonation } from '../../../actions'

const DONOR_TYPES = [
  { value: 'PERSONA_NATURAL',  label: 'Persona natural' },
  { value: 'PERSONA_JURIDICA', label: 'Persona jurídica' },
  { value: 'APORTE_PROPIO',    label: 'Aporte propio del candidato' },
]

const PAYMENT_METHODS = [
  { value: 'EFECTIVO',      label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'CHEQUE',        label: 'Cheque' },
]

interface DonationFormProps {
  topeGastos: number | null
}

export function DonationForm({ topeGastos }: DonationFormProps) {
  const router = useRouter()
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [advertencia, setAdvertencia] = useState<string | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [receiptUrl, setReceiptUrl]   = useState<string | null>(null)
  const [amount, setAmount]           = useState<number>(0)

  // Advertencia preventiva si supera 10% del tope
  const topeDonacion = topeGastos ? topeGastos * 0.1 : null
  const superaTope   = topeDonacion !== null && amount > topeDonacion

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/finanzas/upload-comprobante', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setReceiptUrl(json.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir comprobante')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setAdvertencia(null)

    const fd = new FormData(e.currentTarget)
    try {
      const result = await createDonation({
        donorName:     fd.get('donorName') as string,
        donorId:       (fd.get('donorId') as string) || undefined,
        donorType:     fd.get('donorType') as string,
        amount:        Number(fd.get('amount')),
        date:          fd.get('date') as string,
        paymentMethod: (fd.get('paymentMethod') as string) || undefined,
        bankReference: (fd.get('bankReference') as string) || undefined,
        receiptUrl:    receiptUrl ?? undefined,
        notes:         (fd.get('notes') as string) || undefined,
      })

      if (result.advertencia) {
        setAdvertencia(result.advertencia)
      }

      router.push('/finanzas/donaciones')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar donación')
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
      {advertencia && (
        <div style={{ padding: '0.75rem', background: '#fff7ed', color: '#9a3412', borderRadius: '8px', fontSize: '0.85rem' }}>
          {advertencia}
        </div>
      )}

      <label style={labelStyle}>
        Nombre del donante *
        <input name="donorName" required style={inputStyle} placeholder="Nombre completo o razón social" />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <label style={labelStyle}>
          Cédula o NIT (opcional, se cifra)
          <input name="donorId" style={inputStyle} placeholder="Se almacena cifrado" />
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
            Este dato se cifra y nunca se muestra en reportes
          </span>
        </label>

        <label style={labelStyle}>
          Tipo de donante *
          <select name="donorType" required style={inputStyle}>
            {DONOR_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <label style={labelStyle}>
          Monto (COP) *
          <input
            name="amount"
            type="number"
            min="0"
            step="1"
            required
            style={inputStyle}
            placeholder="0"
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>

        <label style={labelStyle}>
          Fecha *
          <input name="date" type="date" required style={inputStyle} />
        </label>
      </div>

      {/* Advertencia preventiva de tope */}
      {superaTope && topeDonacion && (
        <div style={{
          padding: '0.75rem', background: '#fff7ed', color: '#9a3412',
          borderRadius: '8px', fontSize: '0.85rem', border: '1px solid #fed7aa',
        }}>
          Esta donación (${amount.toLocaleString('es-CO')}) supera el 10% del tope legal
          (${topeDonacion.toLocaleString('es-CO')}). Se permitirá registrar con nota de observación.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <label style={labelStyle}>
          Método de pago
          <select name="paymentMethod" style={inputStyle}>
            <option value="">Seleccionar...</option>
            {PAYMENT_METHODS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Referencia bancaria
          <input name="bankReference" style={inputStyle} placeholder="N° de referencia" />
        </label>
      </div>

      {/* Subida de comprobante */}
      <label style={labelStyle}>
        Comprobante (imagen o PDF, máx. 5MB)
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={handleUpload}
          disabled={uploading}
          style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
        />
        {uploading && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Subiendo...</span>}
        {receiptUrl && (
          <span style={{ fontSize: '0.75rem', color: '#22c55e' }}>Comprobante subido correctamente</span>
        )}
      </label>

      <label style={labelStyle}>
        Notas
        <textarea name="notes" rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Notas adicionales" />
      </label>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button
          type="submit"
          disabled={loading || uploading}
          style={{
            padding: '0.7rem 2rem', fontSize: '0.9rem', borderRadius: '6px',
            border: 'none', background: '#22c55e', color: '#fff',
            cursor: loading ? 'wait' : 'pointer', fontWeight: 600,
          }}
        >
          {loading ? 'Guardando...' : 'Registrar donación'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/finanzas/donaciones')}
          style={{
            padding: '0.7rem 1.5rem', fontSize: '0.9rem', borderRadius: '6px',
            border: '1px solid #cbd5e1', background: '#fff', color: '#334155',
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
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
