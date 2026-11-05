import Link from 'next/link'
import { superadminDb, getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { requireModuleOrRedirect } from '@/lib/auth-helpers'

export const metadata = { title: 'Bitácora de accesos' }

const ACCION: Record<string, string> = {
  LOGIN_OK: 'Entró', LOGIN_FALLIDO: 'Intento fallido de entrar', LOGIN_BLOQUEADO: 'Bloqueado por intentos fallidos',
  VER_FICHA: 'Vio la ficha de un elector', VER_REPORTE: 'Abrió un reporte', IMPORTAR_ELECTORES: 'Importó electores',
  INACTIVAR_ELECTOR: 'Inactivó a un elector', REACTIVAR_ELECTOR: 'Reactivó a un elector',
  SUPRIMIR_DATOS: 'Suprimió los datos de un titular', REVOCAR_AUTORIZACION: 'Revocó una autorización',
  ATENDER_SOLICITUD: 'Respondió una solicitud de titular', CAMBIAR_TEXTOS_LEGALES: 'Cambió la autorización o la política',
}
const ALERTA = new Set(['LOGIN_FALLIDO', 'LOGIN_BLOQUEADO', 'SUPRIMIR_DATOS'])

interface Props { searchParams: Promise<{ a?: string }> }

/** Bitácora de la campaña (solo lectura). Vive en la BD del superadmin: nadie de la campaña la puede editar. */
export default async function BitacoraPage({ searchParams }: Props) {
  const session = await requireModuleOrRedirect('CORE', ['ADMIN_CAMPANA'], 'CORE_BITACORA')
  const { a } = await searchParams
  const tenantId = session.user.tenantId
  const eventos = await superadminDb.registroAcceso.findMany({
    where:   { tenantId, ...(a && a in ACCION && { accion: a }) },
    orderBy: { fecha: 'desc' },
    take:    300,
  })

  // Nombres legibles: quién (cuenta de Vectra) y sobre quién (elector).
  const userIds = [...new Set(eventos.map((e) => e.userId).filter((x): x is string => Boolean(x) && !x!.startsWith('voter:')))]
  const voterIds = [...new Set(eventos.flatMap((e) => [e.sujeto, e.userId?.startsWith('voter:') ? e.userId.slice(6) : null]).filter((x): x is string => Boolean(x) && /^c[a-z0-9]{20,}$/.test(x!)))]
  const [usuarios, voters] = await Promise.all([
    superadminDb.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true } }),
    voterIds.length ? getTenantDb(await getTenantConnection(tenantId)).voter.findMany({ where: { id: { in: voterIds } }, select: { id: true, name: true } }) : [],
  ])
  const quien = new Map(usuarios.map((u) => [u.id, u.name ?? u.email]))
  const persona = new Map(voters.map((v) => [v.id, v.name]))
  const nombreDe = (id: string | null) => id?.startsWith('voter:') ? `${persona.get(id.slice(6)) ?? 'elector'} (app)` : id ? quien.get(id) ?? '—' : '—'

  return (
    <div style={{ maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Bitácora de accesos</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.35rem 0 0' }}>
          Quién entró y quién vio, exportó o borró datos personales. Tras 5 intentos fallidos con la misma cuenta
          (o 30 desde la misma conexión) en 15 minutos, el acceso queda bloqueado esos 15 minutos.
        </p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem' }}>
        <Link href="?" style={{ fontWeight: a ? 400 : 700, color: '#0f172a' }}>Todo</Link>
        {['LOGIN_FALLIDO', 'LOGIN_BLOQUEADO', 'VER_FICHA', 'VER_REPORTE', 'SUPRIMIR_DATOS'].map((k) => (
          <Link key={k} href={`?a=${k}`} style={{ fontWeight: a === k ? 700 : 400, color: '#1e40af' }}>{ACCION[k]}</Link>
        ))}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead><tr style={{ textAlign: 'left', color: '#64748b' }}>{['Fecha', 'Qué', 'Quién', 'Sobre quién', 'Detalle', 'IP'].map((h) => <th key={h} style={{ padding: '0.5rem 0.75rem' }}>{h}</th>)}</tr></thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id} style={{ borderTop: '1px solid #f1f5f9', color: ALERTA.has(e.accion) ? '#b91c1c' : '#0f172a' }}>
                <td style={{ padding: '0.45rem 0.75rem', whiteSpace: 'nowrap' }}>{e.fecha.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style={{ padding: '0.45rem 0.75rem' }}>{ACCION[e.accion] ?? e.accion}</td>
                <td style={{ padding: '0.45rem 0.75rem' }}>{e.accion.startsWith('LOGIN') && !e.userId ? '—' : nombreDe(e.userId)}</td>
                <td style={{ padding: '0.45rem 0.75rem' }}>{e.sujeto ? persona.get(e.sujeto) ?? e.sujeto : '—'}</td>
                <td style={{ padding: '0.45rem 0.75rem' }}>{e.detalle ?? ''}</td>
                <td style={{ padding: '0.45rem 0.75rem', color: '#64748b' }}>{e.ip ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {eventos.length === 0 && <p style={{ padding: '1rem', color: '#64748b', margin: 0 }}>Sin eventos todavía.</p>}
      </div>
    </div>
  )
}
