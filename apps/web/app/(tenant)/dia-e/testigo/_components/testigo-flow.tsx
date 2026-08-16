'use client'

import { useState } from 'react'
import { FotoE14 } from './foto-e14'
import { FormManualE14 } from './form-manual-e14'
import { FormIncidente } from './form-incidente'
import type { MyAssignment, CandidateView, TransmissionDetail } from '../../actions'

type Step = 'idle' | 'photo' | 'manual' | 'incident'

interface ExtractedResult {
  data: { candidateId: string; votes: number }[]
  confidence: string
  discrepancies: string[]
}

/**
 * Las dos obligaciones del testigo en la app, SEPARADAS (ninguna reemplaza a la
 * otra): digitar el conteo de la mesa (siempre) y capturar la foto del E-14
 * (siempre). La foto, además, pre-llena el conteo por comodidad, pero el conteo
 * se puede digitar igual sin ella. Se completa solo cuando están las dos. Aparte,
 * puede reportar un incidente a la Sala.
 */
export function TestigoFlow({
  assignment,
  candidates,
  initialTransmission,
}: {
  assignment: MyAssignment
  candidates: CandidateView[]
  initialTransmission: TransmissionDetail | null
}) {
  const [step, setStep] = useState<Step>('idle')
  const [extracted, setExtracted] = useState<ExtractedResult | null>(null)
  const [countDone, setCountDone] = useState(!!initialTransmission?.manualSubmittedAt)
  const [photoDone, setPhotoDone] = useState(!!initialTransmission?.photoSubmittedAt)

  const status   = initialTransmission?.verificationStatus ?? 'PENDIENTE'
  const completo = countDone && photoDone

  function handlePhotoExtracted(result: ExtractedResult) {
    setExtracted(result)
    setPhotoDone(true)
    // Si el conteo aún no está, se pasa al formulario ya pre-llenado con lo que
    // leyó la IA; si ya estaba, se vuelve al inicio.
    setStep(countDone ? 'idle' : 'manual')
  }

  function handleCountDone() {
    setCountDone(true)
    setStep('idle')
  }

  if (step === 'photo') {
    return (
      <FotoE14
        votingTableId={assignment.votingTableId}
        onExtracted={handlePhotoExtracted}
        onCancel={() => setStep('idle')}
        onManualFallback={() => setStep('manual')}
      />
    )
  }

  if (step === 'manual') {
    return (
      <FormManualE14
        votingTableId={assignment.votingTableId}
        tableNumber={assignment.tableNumber}
        stationName={assignment.stationName}
        municipality={assignment.municipality}
        department={assignment.department}
        departmentCode={assignment.departmentCode}
        municipalityDivipola={assignment.municipalityDivipola}
        cargo={assignment.cargo}
        candidates={candidates}
        extractedData={extracted?.data ?? null}
        extractedConfidence={extracted?.confidence ?? null}
        onTransmitted={handleCountDone}
        onBack={() => setStep('idle')}
      />
    )
  }

  if (step === 'incident') {
    return (
      <FormIncidente
        votingTableId={assignment.votingTableId}
        onClose={() => setStep('idle')}
      />
    )
  }

  // ── Inicio: las dos obligaciones + reportar incidente ───────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {completo
        ? <StatusCard status={status} transmission={initialTransmission} />
        : (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#92400e', fontWeight: 600 }}>
            Falta {[!countDone && 'digitar el conteo', !photoDone && 'la foto del E-14'].filter(Boolean).join(' y ')}.
          </div>
        )}

      <TareaBtn
        done={countDone}
        icono="🔢"
        titulo="Conteo de la mesa"
        detalle="Digita los votos por candidato que cantaron los jurados"
        onClick={() => setStep('manual')}
      />
      <TareaBtn
        done={photoDone}
        icono="📷"
        titulo="Foto del E-14"
        detalle="Captura y envía el acta oficial de la mesa"
        onClick={() => setStep('photo')}
      />

      <button
        onClick={() => setStep('incident')}
        style={{ padding: '0.75rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff', color: '#ef4444', cursor: 'pointer', fontWeight: 500 }}
      >
        Reportar incidente
      </button>
    </div>
  )
}

/** Botón de una obligación, con su ícono y estado (pendiente / hecho). Siempre
 *  clickeable — permite rehacerla (re-transmitir el conteo, retomar la foto). */
function TareaBtn({ done, icono, titulo, detalle, onClick }: {
  done: boolean; icono: string; titulo: string; detalle: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left',
        padding: '1rem', borderRadius: '12px', cursor: 'pointer',
        border: `1px solid ${done ? '#bbf7d0' : '#cbd5e1'}`,
        background: done ? '#f0fdf4' : '#fff',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
        background: done ? '#dcfce7' : '#f1f5f9',
      }}>
        {icono}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{titulo}</div>
        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{detalle}</div>
      </div>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, color: done ? '#166534' : '#b45309' }}>
        {done ? '✓ Hecho' : 'Pendiente'}
      </div>
    </button>
  )
}

function StatusCard({ status, transmission }: {
  status: string
  transmission: TransmissionDetail | null
}) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    VERIFICADO:      { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
    SOLO_MANUAL:     { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
    SOLO_FOTO:       { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
    ADVERTENCIA:     { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
    BAJA_CONFIANZA:  { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
    PENDIENTE:       { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
  }
  const c = colors[status] ?? colors.PENDIENTE

  const labels: Record<string, string> = {
    VERIFICADO:     'Transmisión completa — conteo y foto coinciden',
    SOLO_MANUAL:    'Transmitido — falta que se procese la foto',
    SOLO_FOTO:      'Foto procesada — falta confirmar el conteo',
    ADVERTENCIA:    'Atención — hay diferencias entre el conteo y la foto',
    BAJA_CONFIANZA: 'Confianza baja en la foto — revisa el conteo',
    PENDIENTE:      'Transmisión completa',
  }

  return (
    <div style={{ background: c.bg, border: `2px solid ${c.border}`, borderRadius: '12px', padding: '1.25rem' }}>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: c.text }}>
        {labels[status] ?? status}
      </div>
      {transmission?.manualSubmittedAt && (
        <div style={{ fontSize: '0.8rem', color: c.text, opacity: 0.8, marginTop: '0.25rem' }}>
          Conteo: {new Date(transmission.manualSubmittedAt).toLocaleTimeString('es-CO')}
        </div>
      )}
      {transmission?.photoSubmittedAt && (
        <div style={{ fontSize: '0.8rem', color: c.text, opacity: 0.8 }}>
          Foto: {new Date(transmission.photoSubmittedAt).toLocaleTimeString('es-CO')}
          {transmission.extractionConfidence && ` — Confianza: ${transmission.extractionConfidence}`}
        </div>
      )}
    </div>
  )
}
