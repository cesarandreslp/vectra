import Link       from 'next/link'
import { notFound } from 'next/navigation'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantDb }   from '@vectra/db'

export const metadata = { title: 'Árbol de captación' }

interface Props {
  params: Promise<{ id: string }>
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface NodoReferido {
  id:            string
  name:          string
  captureDepth:  number
  createdAt:     Date
  referrals:     NodoReferido[]
}

// ── Función recursiva de construcción del árbol ───────────────────────────────

/**
 * Construye el árbol de referidos para un líder dado.
 * Los electores de profundidad > 3 se marcan para verificación.
 * Recursivo — la profundidad está acotada por captureDepth (< 10 en práctica).
 */
function construirArbol(
  todos:   { id: string; name: string; captureDepth: number; createdAt: Date; referredById: string | null }[],
  parentId: string | null,
): NodoReferido[] {
  return todos
    .filter((v) => v.referredById === parentId)
    .map((v) => ({
      id:           v.id,
      name:         v.name,
      captureDepth: v.captureDepth,
      createdAt:    v.createdAt,
      referrals:    construirArbol(todos, v.id),
    }))
}

// ── Página ────────────────────────────────────────────────────────────────────

export default async function ArbolCaptacionPage({ params }: Props) {
  const { id } = await params

  const session = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER'], 'CORE_LIDERES')
  const connectionString = await getTenantConnection(session.user.tenantId)
  const db               = getTenantDb(connectionString)

  // Verificar que el líder existe y pertenece al tenant
  const lider = await db.voter.findFirst({
    where:  { id, tenantId: session.user.tenantId },
    select: { id: true, name: true, zone: true },
  })
  if (!lider) notFound()

  // Cargar todos los electores del líder con datos de referidos
  const electores = await db.voter.findMany({
    where:  { leaderId: id, tenantId: session.user.tenantId },
    select: { id: true, name: true, captureDepth: true, createdAt: true, referredById: true },
    orderBy: { captureDepth: 'asc' },
  })

  // Construir árbol desde la raíz (referredById = null → directos del líder)
  const arbol = construirArbol(electores, null)

  // Estadísticas del árbol
  const porNivel = electores.reduce<Record<number, number>>((acc, e) => {
    acc[e.captureDepth] = (acc[e.captureDepth] ?? 0) + 1
    return acc
  }, {})

  const nivelProfundo = electores.filter((e) => e.captureDepth > 3).length

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Navegación */}
      <Link href={`/core/lideres/${id}`} style={{ color: '#64748b', fontSize: '0.875rem', textDecoration: 'none' }}>
        ← Ficha del líder
      </Link>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.75rem', marginBottom: '0.25rem' }}>
        Árbol de captación
      </h1>
      <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        {lider.name}{lider.zone ? ` · ${lider.zone}` : ''}
      </div>

      {/* Estadísticas */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <StatCard titulo="Total electores" valor={electores.length} />
        <StatCard titulo="Registros directos (N0)" valor={porNivel[0] ?? 0} />
        <StatCard titulo="Por referidos (N1+)" valor={electores.length - (porNivel[0] ?? 0)} />
        {nivelProfundo > 0 && (
          <StatCard titulo="Nivel profundo (>N3)" valor={nivelProfundo} alerta />
        )}
      </div>

      {/* Leyenda de niveles */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {Object.entries(porNivel).sort(([a], [b]) => Number(a) - Number(b)).map(([nivel, cnt]) => (
          <div key={nivel} style={{
            background: Number(nivel) > 3 ? '#fef9c3' : '#f1f5f9',
            color:      Number(nivel) > 3 ? '#854d0e' : '#475569',
            padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem',
          }}>
            N{nivel}: {cnt}
          </div>
        ))}
      </div>

      {/* Árbol visual */}
      {arbol.length === 0 ? (
        <div style={{ color: '#94a3b8', padding: '2rem 0' }}>
          Este líder no tiene electores registrados todavía.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
          {arbol.map((nodo) => (
            <NodoArbol key={nodo.id} nodo={nodo} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componentes ───────────────────────────────────────────────────────────────

function NodoArbol({ nodo, nivel = 0 }: { nodo: NodoReferido; nivel?: number }) {
  const esProfundo = nodo.captureDepth > 3

  return (
    <div style={{ marginLeft: nivel * 20 }}>
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '0.5rem',
        padding:      '0.4rem 0',
        borderBottom: nivel === 0 && nodo.referrals.length > 0 ? 'none' : '1px solid #f8fafc',
      }}>
        {/* Indicador de nivel con línea */}
        {nivel > 0 && (
          <span style={{ color: '#cbd5e1', fontSize: '0.75rem', flexShrink: 0 }}>{'└─'}</span>
        )}

        <span style={{ fontSize: '0.875rem', fontWeight: nivel === 0 ? 600 : 400 }}>
          {nodo.name}
        </span>

        {/* Badge de nivel */}
        <span style={{
          background:   esProfundo ? '#fef9c3' : '#f1f5f9',
          color:        esProfundo ? '#854d0e' : '#94a3b8',
          padding:      '0.1rem 0.4rem',
          borderRadius: '4px',
          fontSize:     '0.7rem',
          fontWeight:   esProfundo ? 700 : 400,
          flexShrink:   0,
        }}>
          {esProfundo ? '⚠ ' : ''}N{nodo.captureDepth}
        </span>

        {/* Fecha de registro */}
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 'auto', flexShrink: 0 }}>
          {new Date(nodo.createdAt).toLocaleDateString('es-CO')}
        </span>

        {/* Conteo de referidos directos */}
        {nodo.referrals.length > 0 && (
          <span style={{ fontSize: '0.75rem', color: '#64748b', flexShrink: 0 }}>
            {nodo.referrals.length} referido{nodo.referrals.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Hijos recursivos */}
      {nodo.referrals.map((hijo) => (
        <NodoArbol key={hijo.id} nodo={hijo} nivel={nivel + 1} />
      ))}
    </div>
  )
}

function StatCard({ titulo, valor, alerta = false }: { titulo: string; valor: number; alerta?: boolean }) {
  return (
    <div style={{
      background:   alerta ? '#fef9c3' : '#fff',
      border:       `1px solid ${alerta ? '#fde68a' : '#e2e8f0'}`,
      borderRadius: '8px',
      padding:      '1rem 1.25rem',
      minWidth:     '140px',
    }}>
      <div style={{ fontSize: '0.75rem', color: alerta ? '#854d0e' : '#64748b', marginBottom: '0.25rem' }}>{titulo}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: alerta ? '#92400e' : '#1e293b' }}>{valor}</div>
    </div>
  )
}
