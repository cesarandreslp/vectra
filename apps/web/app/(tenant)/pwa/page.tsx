'use client'

/**
 * Home de la PWA para líderes de base.
 * Ultra-simple, optimizada para celular.
 * Usa SWR para cachear la lista de electores y soportar modo offline.
 *
 * Los electores se ordenan por lastContact ASC (los más viejos primero)
 * para que el líder vea quiénes necesitan atención urgente.
 */

import useSWR              from 'swr'
import dynamic             from 'next/dynamic'
import { useRouter }       from 'next/navigation'
import { IconPhone }       from '@/app/_components/icons'
import { SuscripcionPush } from './_components/suscripcion-push'
import { Invitar }         from './_components/invitar'
import { BannerEncuesta }  from './encuestas/_components/banner-encuesta'

// Leaflet toca `window` — debe cargar solo en cliente, nunca en el render del servidor.
const MapaCalor = dynamic(() => import('./_components/mapa-calor').then(m => m.MapaCalor), { ssr: false })

interface Elector {
  id:               string
  name:             string
  phone:            string | null
  commitmentStatus: string
  lastContact:      string | null
  votingTableId:    string | null
  notes:            string | null
  lat?:             number | null
  lng?:             number | null
  /** Nivel respecto a quien inició sesión: 1 = directo, 2+ = "de mi gente". null = vista sin acotar (staff). */
  depth?:           number | null
  /** Estado frente a la encuesta activa. null = no hay encuesta activa. */
  encuestaEstado?:  'completa' | 'pendiente' | null
  /** Índice de compromiso (encuestas + reuniones + masificación). */
  compromiso?:      { score: number; nivel: 'alto' | 'medio' | 'bajo' } | null
}

const COLOR_COMPROMISO: Record<string, { bg: string; fg: string }> = {
  alto:  { bg: '#dcfce7', fg: '#166534' },
  medio: { bg: '#fef3c7', fg: '#92400e' },
  bajo:  { bg: '#fee2e2', fg: '#991b1b' },
}

const COLORES: Record<string, string> = {
  SIN_CONTACTAR: '#94a3b8',
  CONTACTADO:    '#60a5fa',
  SIMPATIZANTE:  '#fbbf24',
  COMPROMETIDO:  '#4ade80',
  VOTO_SEGURO:   '#22c55e',
}

async function fetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Error al cargar electores')
  return res.json()
}

export default function PwaHomePage() {
  const router = useRouter()
  const { data, error, isLoading, mutate } = useSWR<{
    electores: Elector[]
    tenantSlug?: string
    /** Quien inició sesión, con su QR propio — para invitar desde su pantalla. */
    yo?: { nombre: string; qrToken: string | null } | null
  }>(
    '/api/core/mis-electores',
    fetcher,
    {
      // Revalidar al volver a la app (útil en celular al cambiar de pestaña)
      revalidateOnFocus:      true,
      // Mantener datos anteriores mientras recarga (mejor UX offline)
      keepPreviousData:       true,
      // Reintentar en error (red inestable en campo)
      errorRetryCount:        3,
      errorRetryInterval:     5000,
    },
  )

  const electores = data?.electores ?? []
  const puntosCalor = electores.filter((e): e is Elector & { lat: number; lng: number } => e.lat != null && e.lng != null)

  // Agrupar por profundidad solo si el backend la mandó (vista acotada a LIDER/ELECTOR).
  // Si viene null (staff sin sub-árbol propio), se muestra todo en una sola lista, como antes.
  const conProfundidad = electores.some((e) => e.depth != null)
  const directos  = conProfundidad ? electores.filter((e) => e.depth === 1) : []
  const deMiGente = conProfundidad ? electores.filter((e) => (e.depth ?? 0) >= 2) : []

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Mis electores</h1>
          {!isLoading && (
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
              {electores.length} registros
            </div>
          )}
        </div>
        <button
          onClick={() => mutate()}
          style={{
            background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px',
            padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#64748b',
          }}
        >
          Actualizar
        </button>
      </div>

      <SuscripcionPush />
      <BannerEncuesta />

      {data?.yo?.qrToken && (
        <div style={{ marginBottom: '1rem' }}>
          <Invitar
            qrToken={data.yo.qrToken}
            tenantSlug={data.tenantSlug ?? ''}
            nombre={data.yo.nombre}
            compacto
          />
        </div>
      )}

      {/* Estado de carga / error */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>
          Cargando...
        </div>
      )}

      {error && (
        <div style={{
          background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem',
          borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1rem',
        }}>
          Sin conexión — mostrando datos guardados localmente.
        </div>
      )}

      {/* Mapa de calor — solo si hay al menos un elector ubicado */}
      {puntosCalor.length > 0 && <MapaCalor puntos={puntosCalor} />}

      {/* Lista de electores */}
      {conProfundidad ? (
        <>
          <ListaElectores titulo="Directos" electores={directos} router={router} />
          <ListaElectores titulo="De mi gente" electores={deMiGente} router={router} />
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {electores.map((elector) => (
            <TarjetaElector key={elector.id} elector={elector} router={router} />
          ))}
        </div>
      )}

      {!isLoading && electores.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>
          No tienes electores asignados todavía.
        </div>
      )}
    </div>
  )
}

function ListaElectores({ titulo, electores, router }: {
  titulo: string; electores: Elector[]; router: ReturnType<typeof useRouter>
}) {
  if (electores.length === 0) return null
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.5rem' }}>
        {titulo} ({electores.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {electores.map((elector) => (
          <TarjetaElector key={elector.id} elector={elector} router={router} />
        ))}
      </div>
    </div>
  )
}

function TarjetaElector({ elector, router }: { elector: Elector; router: ReturnType<typeof useRouter> }) {
  return (
    // div+onClick en vez de <Link>: el botón de llamada de adentro es un <a>
    // (tel:), y <a> dentro de <a> es HTML inválido — causaba error de hidratación.
    <div
      onClick={() => router.push(`/pwa/electores/${elector.id}`)}
      style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
    >
      <div
        style={{
          background:   '#fff',
          border:       '1px solid #e2e8f0',
          borderLeft:   `4px solid ${COLORES[elector.commitmentStatus] ?? '#cbd5e1'}`,
          borderRadius: '8px',
          padding:      '0.875rem 1rem',
          display:      'flex',
          justifyContent: 'space-between',
          alignItems:   'center',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{elector.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
            {elector.lastContact
              ? `Último contacto: ${new Date(elector.lastContact).toLocaleDateString('es-CO')}`
              : 'Sin contacto registrado'}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {elector.encuestaEstado && (
              <div style={{
                display: 'inline-block', marginTop: '4px', padding: '0.1rem 0.5rem',
                borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
                background: elector.encuestaEstado === 'completa' ? '#dcfce7' : '#fef3c7',
                color:      elector.encuestaEstado === 'completa' ? '#166534' : '#92400e',
              }}>
                {elector.encuestaEstado === 'completa' ? 'Encuesta respondida' : 'Encuesta pendiente'}
              </div>
            )}
            {elector.compromiso && (
              <div style={{
                display: 'inline-block', marginTop: '4px', padding: '0.1rem 0.5rem',
                borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
                background: COLOR_COMPROMISO[elector.compromiso.nivel].bg,
                color:      COLOR_COMPROMISO[elector.compromiso.nivel].fg,
              }}>
                Compromiso {elector.compromiso.nivel}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Botón click-to-call — solo si hay teléfono */}
          {elector.phone && (
            <a
              href={`tel:${elector.phone}`}
              onClick={e => e.stopPropagation()}
              style={{
                display:        'inline-flex',
                alignItems:     'center',
                justifyContent: 'center',
                background:     '#dbeafe',
                color:          '#1e40af',
                padding:        '0.45rem',
                borderRadius:   '6px',
                textDecoration: 'none',
              }}
            >
              <IconPhone size={16} />
            </a>
          )}

          {/* Indicador de estado */}
          <div
            style={{
              width:        '10px',
              height:       '10px',
              borderRadius: '50%',
              background:   COLORES[elector.commitmentStatus] ?? '#cbd5e1',
              flexShrink:   0,
            }}
          />
        </div>
      </div>
    </div>
  )
}
