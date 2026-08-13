import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { TemplateEditor } from './_components/template-editor'

export default async function NuevaPlantillaPage() {
  await requireModuleOrRedirect('COMUNICACIONES', ['ADMIN_CAMPANA'])

  return (
    <div style={{ maxWidth: '800px' }}>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', color: '#0f172a' }}>
        Nueva plantilla
      </h1>
      <TemplateEditor />
    </div>
  )
}
