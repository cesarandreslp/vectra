'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createExpense } from '../../../actions'

const CATEGORIES = [
  { value: 'PUBLICIDAD',  label: 'Publicidad' },
  { value: 'TRANSPORTE',  label: 'Transporte' },
  { value: 'LOGISTICA',   label: 'Logística' },
  { value: 'PERSONAL',    label: 'Personal' },
  { value: 'TECNOLOGIA',  label: 'Tecnología' },
  { value: 'EVENTOS',     label: 'Eventos' },
  { value: 'JURIDICO',    label: 'Jurídico' },
  { value: 'OTRO',        label: 'Otro' },
]

const PAYMENT_METHODS = [
  { value: 'EFECTIVO',      label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'CHEQUE',        label: 'Cheque' },
]

interface ExpenseFormProps {
  topeGastos: number | null
}

export function ExpenseForm({ topeGastos }: ExpenseFormProps) {
  const router = useRouter()
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [advertencia, setAdvertencia] = useState<string | null>(null)
  const [uploading, setUploading]   = useState(false)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

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
      setInvoiceUrl(json.url)
      setPreviewUrl(URL.createObjectURL(file))
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
      const result = await createExpense({
        category:      fd.get('category') as string,
        description:   fd.get('description') as string,
        amount:        Number(fd.get('amount')),
        date:          fd.get('date') as string,
        vendor:        (fd.get('vendor') as string) || undefined,
        invoiceNumber: (fd.get('invoiceNumber') as string) || undefined,
        invoiceUrl:    invoiceUrl ?? undefined,
        paymentMethod: (fd.get('paymentMethod') as string) || undefined,
        notes:         (fd.get('notes') as string) || undefined,
      })

      if (result.advertencia) {
        setAdvertencia(result.advertencia)
      }

      router.push('/finanzas/gastos')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar gasto')
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <label style={labelStyle}>
          Categoría *
          <select name="category" required style={inputStyle}>
            <option value="">Seleccionar...</option>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Monto (COP) *
          <input name="amount" type="number" min="0" step="1" required style={inputStyle} placeholder="0" />
        </label>
      </div>

      <label style={labelStyle}>
        Descripción *
        <input name="description" required style={inputStyle} placeholder="Descripción del gasto" />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <label style={labelStyle}>
          Fecha *
          <input name="date" type="date" required style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Proveedor / Beneficiario
          <input name="vendor" style={inputStyle} placeholder="Nombre del proveedor" />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <label style={labelStyle}>
          N° Factura
          <input name="invoiceNumber" style={inputStyle} placeholder="Número de factura" />
        </label>

        <label style={labelStyle}>
          Método de pago
          <select name="paymentMethod" style={inputStyle}>
            <option value="">Seleccionar...</option>
            {PAYMENT_METHODS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
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
      </label>

      {previewUrl && (
        <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0.5rem' }}>
          <img
            src={previewUrl}
            alt="Comprobante"
            style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.25rem' }}>
            Comprobante subido correctamente
          </div>
        </div>
      )}

      <label style={labelStyle}>
        Notas
        <textarea name="notes" rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Notas adicionales" />
      </label>

      {topeGastos && (
        <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '0.5rem', background: '#f8fafc', borderRadius: '6px' }}>
          Tope legal configurado: ${topeGastos.toLocaleString('es-CO')} COP
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button
          type="submit"
          disabled={loading || uploading}
          style={{
            padding: '0.7rem 2rem', fontSize: '0.9rem', borderRadius: '6px',
            border: 'none', background: '#1e40af', color: '#fff',
            cursor: loading ? 'wait' : 'pointer', fontWeight: 600,
          }}
        >
          {loading ? 'Guardando...' : 'Registrar gasto'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/finanzas/gastos')}
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
