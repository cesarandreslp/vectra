import Link from 'next/link'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'
import { TIPOS_SOLICITUD, type TipoSolicitud } from '@/lib/politica-datos'
import { listSolicitudes } from './actions'
import { AtenderSolicitud } from './_components/atender-solicitud'

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' })
const HECHO: Record<string, string> = { SUPRIMIDO: 'Datos suprimidos', REVOCADA: 'Autorización revocada', NINGUNA: 'Respondida' }

export default async function DatosPersonalesPage() {
  const session = await requireModuleOrRedirect('CORE', ['ADMIN_CAMPANA'], 'CORE_DATOS_PERSONALES')
  const filas = await listSolicitudes()
  const pendientes = filas.filter((f) => f.estado === 'RECIBIDA')

  return (
    <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Datos personales: solicitudes de titulares</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.35rem 0 0' }}>
          Llegan por la página pública de la campaña:{' '}
          <Link href={`/privacidad?c=${session.user.tenantSlug ?? ''}`} style={{ color: '#1e40af' }}>política y derechos</Link>.
          Plazo legal: 10 días hábiles para consultas y 15 para reclamos. Antes de suprimir o corregir, confirma por el contacto que quien pide es el titular.
        </p>
      </div>

      {filas.length === 0 && <p style={{ color: '#64748b' }}>No hay solicitudes.</p>}
      {pendientes.length > 0 && <h2 style={{ fontSize: '1rem', margin: '0.5rem 0 0' }}>Por atender ({pendientes.length})</h2>}

      {filas.map((f) => (
        <div key={f.id} style={{
          background: '#fff', borderRadius: 8, padding: '1rem',
          border: `1px solid ${f.vencida ? '#fca5a5' : '#e2e8f0'}`, opacity: f.estado === 'ATENDIDA' ? 0.75 : 1,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem' }}>
            <b>{TIPOS_SOLICITUD[f.tipo as TipoSolicitud] ?? f.tipo}</b>
            <span style={{ fontSize: '0.8rem', color: f.vencida ? '#b91c1c' : '#64748b', fontWeight: f.vencida ? 700 : 400 }}>
              {f.estado === 'ATENDIDA' ? `${HECHO[f.accion ?? ''] ?? 'Atendida'} el ${fecha(f.atendidaEn!)}` : `${f.vencida ? 'VENCIÓ' : 'Vence'} el ${fecha(f.venceEn)}`}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.35rem' }}>
            {f.nombre} · {f.contacto} · recibida el {fecha(f.createdAt)}
            {' · '}{f.elector
              ? <Link href={`/core/electores/${f.elector.id}`} style={{ color: '#1e40af' }}>en el padrón como {f.elector.nombre}</Link>
              : <span>esa cédula no está en el padrón</span>}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.35rem', whiteSpace: 'pre-line' }}>{f.detalle}</div>
          {f.respuesta && <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', background: '#f8fafc', padding: '0.5rem', borderRadius: 6 }}>Respuesta: {f.respuesta}</div>}
          {f.estado === 'RECIBIDA' && <AtenderSolicitud id={f.id} tipo={f.tipo} hayElector={Boolean(f.elector)} />}
        </div>
      ))}
    </div>
  )
}
