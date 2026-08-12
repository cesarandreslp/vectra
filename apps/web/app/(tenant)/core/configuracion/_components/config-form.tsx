'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { coloresDeLogo } from '@/lib/color-de-logo'
import { guardarConfiguracion, listarMunicipios, type ConfiguracionView, type Cargo, type Opcion } from '../actions'

const CARGOS: { value: Cargo; label: string }[] = [
  { value: 'ALCALDE',       label: 'Alcalde/Alcaldesa' },
  { value: 'CONCEJAL',      label: 'Concejal' },
  { value: 'GOBERNADOR',    label: 'Gobernador/Gobernadora' },
  { value: 'DIPUTADO',      label: 'Diputado (Asamblea Departamental)' },
  { value: 'REPRESENTANTE', label: 'Representante a la Cámara' },
  { value: 'SENADOR',       label: 'Senador/Senadora' },
  { value: 'PRESIDENTE',    label: 'Presidente' },
]

export function ConfigForm({ inicial, departamentos }: { inicial: ConfiguracionView; departamentos: Opcion[] }) {
  const [groqKey,   setGroqKey]   = useState('')
  const [zhipuKey,  setZhipuKey]  = useState('')
  const [color,     setColor]     = useState(inicial.primaryColor ?? '#7d2839')
  const [domain,    setDomain]    = useState(inicial.domain ?? '')
  const [logoUrl,   setLogoUrl]   = useState(inicial.logoUrl)
  const [cargo,     setCargo]     = useState<Cargo | ''>(inicial.electionOffice ?? '')
  const [deptoCode, setDeptoCode] = useState(inicial.electionDepartmentCode ?? '')
  const [muniCode,  setMuniCode]  = useState(inicial.electionMunicipalityDivipola ?? '')
  const [municipios, setMunicipios] = useState<Opcion[]>([])
  const [msg,       setMsg]       = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [subiendo,  setSubiendo]  = useState(false)
  const [sugeridos, setSugeridos] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    if (!deptoCode) { setMunicipios([]); return }
    listarMunicipios(deptoCode).then(setMunicipios)
  }, [deptoCode])

  // Sugerencias a partir del logo ya subido. Puede no dar nada (CORS, SVG sin
  // tamaño, logo todo blanco) y entonces la fila de sugerencias no se muestra:
  // es una ayuda, no un requisito del formulario.
  useEffect(() => {
    if (!inicial.logoUrl) return
    coloresDeLogo(inicial.logoUrl).then(setSugeridos)
  }, [inicial.logoUrl])
  // Los campos sensibles arrancan readOnly para que el navegador NO los autocomplete
  // al cargar (metía el email en Dominio y una contraseña en las claves). Se
  // desbloquean al primer foco, cuando el autofill de carga ya pasó.
  const [editable,  setEditable]  = useState(false)
  const antiAutofill = {
    readOnly: !editable,
    onFocus:  () => setEditable(true),
  }
  const [isPending, startTransition] = useTransition()

  async function subirLogo(file: File) {
    setSubiendo(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/core/upload-logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ tipo: 'error', texto: data.error ?? 'No se pudo subir el logo.' })
        return
      }
      setLogoUrl(data.url)

      // El tema toma el color del logo sin pedir un clic. Se lee del archivo
      // local, no de la URL recién subida: así no depende de CORS ni de que el
      // blob ya esté servible.
      const colores = await coloresDeLogo(file)
      setSugeridos(colores)
      if (colores.length === 0) {
        setMsg({ tipo: 'ok', texto: 'Logo actualizado. No se pudo deducir un color; elígelo a mano.' })
        return
      }

      setColor(colores[0])
      // Se persiste aquí y no al pulsar "Guardar cambios" porque el logo también
      // se guardó solo al subirlo: dejar el color a medio aplicar sería peor.
      const guardado = await guardarConfiguracion({ primaryColor: colores[0] })
      if (!guardado.success) {
        setMsg({ tipo: 'error', texto: guardado.error })
        return
      }
      setMsg({ tipo: 'ok', texto: `Logo actualizado. El tema tomó el color ${colores[0]} del logo.` })
      router.refresh() // repinta el shell con el color nuevo, sin recargar a mano
    } catch {
      setMsg({ tipo: 'error', texto: 'No se pudo subir el logo.' })
    } finally {
      setSubiendo(false)
    }
  }

  function guardar() {
    setMsg(null)
    startTransition(async () => {
      const res = await guardarConfiguracion({
        groqApiKey:   groqKey || undefined,
        zhipuApiKey:  zhipuKey || undefined,
        primaryColor: color,
        domain,
        electionOffice:               cargo,
        electionDepartmentCode:       deptoCode,
        electionMunicipalityDivipola: muniCode,
      })
      if (res.success) {
        setGroqKey('')
        setZhipuKey('')
        setMsg({ tipo: 'ok', texto: 'Configuración guardada.' })
      } else {
        setMsg({ tipo: 'error', texto: res.error })
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* ── Branding ─────────────────────────────────────────────────────── */}
      <Seccion titulo="Branding">
        <Campo label="Logo de la campaña">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="Logo" style={{ height: 40, width: 'auto', maxWidth: 160, objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', padding: 4 }} />
              : <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Sin logo</span>}
            <label style={{ ...estiloBoton, background: subiendo ? '#94a3b8' : '#e2e8f0', color: '#0f172a', cursor: subiendo ? 'wait' : 'pointer' }}>
              {subiendo ? 'Subiendo…' : 'Subir logo'}
              <input
                type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                style={{ display: 'none' }} disabled={subiendo}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogo(f) }}
              />
            </label>
          </div>
          <p style={estiloHint}>
            PNG, JPG, SVG o WEBP. Máximo 2MB. Al subirlo, el tema de la campaña
            toma el color dominante del logo.
          </p>
        </Campo>

        <Campo label="Color primario">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 36, border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff' }} />
            <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#7d2839" style={{ ...estiloInput, maxWidth: 140, fontFamily: 'monospace' }} />
          </div>

          {/* Al subir un logo, el tema toma solo su color dominante. Los demás
              colores del logo quedan aquí a un clic, porque un banner con varias
              tintas no tiene un color de marca objetivo y el dominante puede no
              ser el que la campaña considera suyo. */}
          {sugeridos.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ ...estiloHint, marginTop: 0 }}>Del logo:</span>
              {sugeridos.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={`Usar ${c}`}
                  aria-label={`Usar el color ${c} del logo`}
                  style={{
                    width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer',
                    // El seleccionado se marca con un aro, no con un borde de color:
                    // sobre un swatch claro un borde claro no se distingue.
                    border: '1px solid rgba(0,0,0,0.15)',
                    outline: color.toLowerCase() === c ? '2px solid #0f172a' : 'none',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          )}
        </Campo>
      </Seccion>

      {/* ── Elección ─────────────────────────────────────────────────────── */}
      <Seccion titulo="Elección">
        <Campo label="País">
          <input type="text" value={inicial.electionCountry} disabled style={{ ...estiloInput, background: '#f1f5f9', color: '#64748b' }} />
        </Campo>
        <Campo label="Cargo al que aspira el candidato">
          <select value={cargo} onChange={(e) => setCargo(e.target.value as Cargo | '')} style={estiloInput}>
            <option value="">Selecciona un cargo…</option>
            {CARGOS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Campo>
        <Campo label="Departamento">
          <select
            value={deptoCode}
            onChange={(e) => { setDeptoCode(e.target.value); setMuniCode('') }}
            style={estiloInput}
          >
            <option value="">Selecciona un departamento…</option>
            {departamentos.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </Campo>
        <Campo label="Municipio">
          <select
            value={muniCode}
            onChange={(e) => setMuniCode(e.target.value)}
            disabled={!deptoCode}
            style={{ ...estiloInput, ...(!deptoCode ? { background: '#f1f5f9', color: '#94a3b8' } : {}) }}
          >
            <option value="">{deptoCode ? 'Selecciona un municipio…' : 'Primero elige un departamento'}</option>
            {municipios.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
          </select>
        </Campo>
        <p style={estiloHint}>
          Acota el universo electoral para medir veracidad de votantes y proyecciones.
        </p>
      </Seccion>

      {/* ── Dominio ──────────────────────────────────────────────────────── */}
      <Seccion titulo="Dominio propio">
        <Campo label="Dominio de la campaña">
          <input type="text" name="campaign-domain" autoComplete="off" {...antiAutofill} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="micampana.com.co" style={estiloInput} />
          <p style={estiloHint}>Apuntar el DNS al sistema es un paso aparte; aquí solo se registra el dominio.</p>
        </Campo>
      </Seccion>

      {/* ── IA ───────────────────────────────────────────────────────────── */}
      <Seccion titulo="Inteligencia artificial (claves propias)">
        <Campo label="Groq API key">
          <input
            type="password" name="groq-api-key" autoComplete="new-password" {...antiAutofill}
            value={groqKey} onChange={(e) => setGroqKey(e.target.value)}
            placeholder={inicial.hasGroqKey ? '•••••••• (ya configurada)' : 'gsk_…'}
            style={estiloInput}
          />
        </Campo>
        <Campo label="Zhipu API key">
          <input
            type="password" name="zhipu-api-key" autoComplete="new-password" {...antiAutofill}
            value={zhipuKey} onChange={(e) => setZhipuKey(e.target.value)}
            placeholder={inicial.hasZhipuKey ? '•••••••• (ya configurada)' : '…'}
            style={estiloInput}
          />
        </Campo>
        <p style={estiloHint}>
          Se guardan cifradas. Déjalas en blanco para no cambiarlas. Si no configuras
          ninguna, la campaña usa las claves globales del sistema.
        </p>
      </Seccion>

      {msg && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.875rem',
          background: msg.tipo === 'ok' ? '#dcfce7' : '#fee2e2',
          color:      msg.tipo === 'ok' ? '#166534' : '#991b1b',
        }}>
          {msg.texto}
        </div>
      )}

      <div>
        <button onClick={guardar} disabled={isPending} style={{ ...estiloBoton, background: isPending ? '#94a3b8' : '#0f172a', color: '#fff', cursor: isPending ? 'not-allowed' : 'pointer' }}>
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem' }}>
      <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>{titulo}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '0.35rem' }}>{label}</label>
      {children}
    </div>
  )
}

const estiloInput: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #cbd5e1',
  borderRadius: 6, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
}

const estiloBoton: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', border: 'none',
  padding: '0.6rem 1.25rem', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600,
}

const estiloHint: React.CSSProperties = {
  fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem',
}
