import { FormularioEncuesta } from './_components/formulario-encuesta'

export default function PwaEncuestasPage() {
  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem' }}>Encuesta</h1>
      <FormularioEncuesta />
    </div>
  )
}
