export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export const estiloInput: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1',
  borderRadius: '6px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
}

interface SelectorProps {
  label:    string
  value:    string
  onChange: (valor: string) => void
  opciones: { value: string; label: string }[]
  /** Texto de la opción vacía; sin él no hay opción vacía. */
  vacio?:   string
}

export function Selector({ label, value, onChange, opciones, vacio }: SelectorProps) {
  return (
    <Campo label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...estiloInput, background: '#fff' }}>
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Campo>
  )
}

interface TextoProps {
  label:        string
  value:        string
  onChange:     (valor: string) => void
  type?:        'text' | 'tel'
  required?:    boolean
  placeholder?: string
  ayuda?:       string
}

export function Texto({ label, value, onChange, type = 'text', required, placeholder, ayuda }: TextoProps) {
  return (
    <Campo label={label}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} style={estiloInput} />
      {ayuda && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px' }}>{ayuda}</div>}
    </Campo>
  )
}
