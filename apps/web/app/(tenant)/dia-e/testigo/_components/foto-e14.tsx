'use client'

import { useState, useRef } from 'react'
import { submitPhotoE14 } from '../../actions'

interface ExtractedResult {
  data: { candidateId: string; votes: number }[]
  confidence: string
  discrepancies: string[]
}

export function FotoE14({
  votingTableId,
  countHecho,
  onExtracted,
  onCancel,
  onManualFallback,
}: {
  votingTableId: string
  /** Si el testigo ya digitó el conteo. Si no, enviar solo la foto pide confirmación. */
  countHecho: boolean
  onExtracted: (result: ExtractedResult) => void
  onCancel: () => void
  onManualFallback: () => void
}) {
  const [preview, setPreview]     = useState<string | null>(null)
  const [file, setFile]           = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [advertencia, setAdvertencia] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // El conteo es obligatorio. Si falta y quiere mandar solo la foto, se le
  // advierte y tiene que confirmar antes de subir nada.
  function intentarEnviar() {
    if (!countHecho) { setAdvertencia(true); return }
    void handleSubmit()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError(null)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  function handleRetake() {
    setPreview(null)
    setFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!file) return
    setUploading(true)
    setError(null)

    try {
      // Paso 1: Subir foto a Vercel Blob
      const formData = new FormData()
      formData.append('file', file)
      formData.append('votingTableId', votingTableId)

      const uploadRes = await fetch('/api/dia-e/upload-foto', {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()

      if (!uploadData.success) {
        setError(uploadData.error ?? 'Error al subir la imagen.')
        setUploading(false)
        return
      }

      setUploading(false)
      setProcessing(true)

      // Paso 2: Enviar URL al servidor para procesamiento IA
      const result = await submitPhotoE14(votingTableId, uploadData.url)

      setProcessing(false)

      if (result.success && result.extractedData) {
        onExtracted({
          data:          result.extractedData,
          confidence:    result.confidence ?? 'MEDIA',
          discrepancies: result.discrepancies ?? [],
        })
      } else {
        setError(result.error ?? 'No se pudo procesar la imagen.')
      }
    } catch {
      setUploading(false)
      setProcessing(false)
      setError('Error de conexión. Verifica tu internet.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
          Fotografía el acta E-14
        </h2>
        <button onClick={onCancel} style={linkBtnStyle}>Cancelar</button>
      </div>

      {!preview && (
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '0.75rem',
          padding: '3rem 1.5rem', borderRadius: '12px',
          border: '3px dashed #cbd5e1', background: '#f8fafc',
          cursor: 'pointer', textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem' }}>&#128247;</div>
          <div style={{ fontWeight: 600, color: '#334155' }}>
            Toca para tomar la foto
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Asegúrate de que el formulario esté bien iluminado y legible
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
      )}

      {preview && (
        <>
          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <img
              src={preview}
              alt="Vista previa del E-14"
              style={{ width: '100%', display: 'block' }}
            />
          </div>

          {!uploading && !processing && !advertencia && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={handleRetake} style={{
                flex: 1, padding: '0.75rem', fontSize: '0.875rem', borderRadius: '8px',
                border: '1px solid #cbd5e1', background: '#fff', color: '#334155',
                cursor: 'pointer', fontWeight: 500,
              }}>
                Retomar
              </button>
              <button onClick={intentarEnviar} style={{
                flex: 2, padding: '0.75rem', fontSize: '0.875rem', borderRadius: '8px',
                border: 'none', background: '#1e40af', color: '#fff',
                cursor: 'pointer', fontWeight: 600,
              }}>
                Usar esta foto
              </button>
            </div>
          )}

          {advertencia && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#991b1b', lineHeight: 1.5 }}>
                <strong>Falta digitar el conteo.</strong> La digitación de los resultados
                del conteo de la mesa es obligatoria. Transmitir solo la foto del E-14,
                sin esos datos, genera dudas sobre tu desempeño como testigo en esta mesa.
                ¿Deseas continuar con el envío de todas formas?
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => { setAdvertencia(false); onCancel() }} style={{
                  flex: 2, padding: '0.7rem', fontSize: '0.85rem', borderRadius: '8px',
                  border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 700,
                }}>
                  Hacer el conteo primero
                </button>
                <button onClick={() => { setAdvertencia(false); void handleSubmit() }} style={{
                  flex: 1, padding: '0.7rem', fontSize: '0.85rem', borderRadius: '8px',
                  border: '1px solid #ef4444', background: '#fff', color: '#991b1b', cursor: 'pointer', fontWeight: 600,
                }}>
                  Enviar solo la foto
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {uploading && (
        <div style={{
          padding: '1.5rem', textAlign: 'center', background: '#dbeafe',
          borderRadius: '12px', color: '#1e40af', fontWeight: 500,
        }}>
          Subiendo imagen...
        </div>
      )}

      {processing && (
        <div style={{
          padding: '1.5rem', textAlign: 'center', background: '#dbeafe',
          borderRadius: '12px', color: '#1e40af', fontWeight: 500,
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>&#9881;&#65039;</div>
          Procesando con IA...
          <div style={{ fontSize: '0.8rem', fontWeight: 400, marginTop: '0.25rem' }}>
            Dos modelos analizan tu foto en paralelo
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '1rem', background: '#fee2e2', borderRadius: '8px',
          color: '#991b1b', fontSize: '0.875rem',
        }}>
          {error}
          <button onClick={onManualFallback} style={{
            display: 'block', marginTop: '0.75rem',
            padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '6px',
            border: '1px solid #991b1b', background: '#fff', color: '#991b1b',
            cursor: 'pointer', fontWeight: 500,
          }}>
            Digita los datos manualmente
          </button>
        </div>
      )}
    </div>
  )
}

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#64748b',
  fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline',
}
