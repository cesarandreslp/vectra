'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import 'leaflet/dist/leaflet.css'
import { geocodificarPendientes, type VoterGeo, type GeoStats, type StationGeo, type ComunaGeo, type BarrioGeo, type TestigosGeoResult, type CentroMunicipio } from '../actions'
import { intensidadDeEstado, COLOR_TEMPERATURA, ETIQUETA_TEMPERATURA, GRADIENTE_CALOR } from '@/lib/temperatura'

const COLOR_ESTADO: Record<string, string> = {
  SIN_CONTACTAR: '#94a3b8',
  CONTACTADO:    '#3b82f6',
  SIMPATIZANTE:  '#eab308',
  COMPROMETIDO:  '#22c55e',
  VOTO_SEGURO:   '#15803d',
}

const COLOR_JURISDICCION: Record<StationGeo['estado'], string> = {
  CUENTA:    '#22c55e',
  NO_CUENTA: '#ef4444',
}

type Vista = 'residencia' | 'puesto' | 'comuna' | 'barrio' | 'testigos' | 'calor'

/** En la vista Testigos: dibujar cada testigo en su casa o en el puesto que vigila. */
type UbicarPor = 'residencia' | 'puesto'

const ETIQUETA_VISTA: Record<Vista, string> = {
  residencia: 'Por residencia',
  puesto:     'Por puesto de votación',
  comuna:     'Por comuna',
  barrio:     'Por barrio',
  testigos:   'Testigos',
  calor:      'Mapa de calor',
}

/** Un testigo con mesa está cubriendo algo; sin mesa es capacidad ociosa. */
const COLOR_TESTIGO = { conMesa: '#16a34a', sinMesa: '#f59e0b' } as const

function dibujarCapaResidencia(L: typeof import('leaflet'), capa: import('leaflet').FeatureGroup, puntos: VoterGeo[]) {
  for (const p of puntos) {
    const color = COLOR_ESTADO[p.commitmentStatus] ?? '#94a3b8'
    L.circleMarker([p.lat, p.lng], {
      radius: 9, weight: 2, color: '#fff', // borde blanco para que resalte sobre el mapa base
      fillOpacity: 1, fillColor: color,
    })
      .bindPopup(
        `<b>${p.name}</b><br>${p.commitmentStatus.replace(/_/g, ' ')}` +
        (p.leaderName ? `<br>Líder: ${p.leaderName}` : ''),
      )
      .addTo(capa)
  }
}

function dibujarCapaComunas(L: typeof import('leaflet'), capa: import('leaflet').FeatureGroup, comunas: ComunaGeo[], puntos: VoterGeo[]) {
  comunas.forEach((c) => {
    // El color viene del servidor, no del índice en este array: así una comuna
    // se ve del mismo color aquí y en Territorio, aunque las listas difieran.
    L.polygon(c.boundary, {
      color: c.color, weight: 2, fillColor: c.color, fillOpacity: 0.35,
    })
      .bindPopup(`<b>${c.name}</b><br>${c.totalElectores} elector(es)`)
      .addTo(capa)
  })
  // Encima de las comunas sombreadas, los electores ubicados (mismos puntos que "por residencia").
  dibujarCapaResidencia(L, capa, puntos)
}

/**
 * Mismo tratamiento que las comunas, un nivel más abajo. Los barrios se dibujan
 * con más opacidad de borde porque son chicos y vecinos entre sí: con el borde
 * fino de comuna, dos barrios pegados se leen como uno solo.
 */
function dibujarCapaBarrios(L: typeof import('leaflet'), capa: import('leaflet').FeatureGroup, barrios: BarrioGeo[], puntos: VoterGeo[]) {
  barrios.forEach((b) => {
    L.polygon(b.boundary, {
      color: b.color, weight: 2, fillColor: b.color, fillOpacity: 0.35,
    })
      .bindPopup(`<b>${b.name}</b><br>${b.comunaName}<br>${b.totalElectores} elector(es)`)
      .addTo(capa)
  })
  dibujarCapaResidencia(L, capa, puntos)
}

/**
 * Testigos, dibujados en la casa de cada uno — ser testigo es una condición del
 * elector, no otra entidad, así que el punto es el mismo de "por residencia".
 * El color dice lo único que importa acá: si ya tiene mesa o no.
 */
function dibujarCapaTestigos(L: typeof import('leaflet'), capa: import('leaflet').FeatureGroup, testigos: TestigosGeoResult['testigos'], ubicarPor: UbicarPor) {
  for (const t of testigos) {
    const lat = ubicarPor === 'puesto' ? t.puestoLat : t.lat
    const lng = ubicarPor === 'puesto' ? t.puestoLng : t.lng
    if (lat == null || lng == null) continue
    const color = t.mesa ? COLOR_TESTIGO.conMesa : COLOR_TESTIGO.sinMesa
    // En modo puesto, un punto aproximado (centroide de votantes) se dibuja
    // punteado, para no hacerlo pasar por la sede real.
    const aprox = ubicarPor === 'puesto' && t.puestoAprox
    L.circleMarker([lat, lng], {
      radius: 9, weight: 2, color: '#fff', fillOpacity: aprox ? 0.55 : 1, fillColor: color,
      dashArray: aprox ? '3' : undefined,
    })
      .bindPopup(
        `<b>${t.name}</b><br>` +
        (t.mesa ? `${t.mesa} · ${t.puesto}` : '<i>Sin mesa asignada</i>') +
        (aprox ? '<br><i>Puesto sin geocodificar — ubicación aproximada</i>' : ''),
      )
      .addTo(capa)
  }
}

function dibujarCapaPuestos(L: typeof import('leaflet'), capa: import('leaflet').FeatureGroup, puestos: StationGeo[]) {
  for (const s of puestos) {
    L.circleMarker([s.lat, s.lng], {
      radius: 8,
      weight: s.specialLabel ? 3 : 1,
      color: s.specialLabel ? '#0f172a' : COLOR_JURISDICCION[s.estado],
      fillOpacity: 0.85,
      fillColor: COLOR_JURISDICCION[s.estado],
    })
      .bindPopup(
        `${s.specialLabel ? `⚑ ${s.specialLabel}<br>` : ''}<b>${s.name}</b><br>${s.totalElectores} elector(es) · ${s.estado === 'CUENTA' ? 'dentro de jurisdicción' : 'fuera de jurisdicción'}`,
      )
      .addTo(capa)
  }
}

/** Zoom al que se ve un municipio colombiano entero sin perder las calles. */
const ZOOM_MUNICIPIO = 13
/** Vista de arranque si la campaña aún no tiene municipio configurado. */
const VISTA_COLOMBIA: [[number, number], number] = [[4.6, -74.08], 5]

export function MapaElectores({ puntos, geoStats, puestos, comunas, barrios: barriosGeo, testigos, centro }: {
  puntos: VoterGeo[]; geoStats: GeoStats; puestos: StationGeo[]; comunas: ComunaGeo[]
  barrios: BarrioGeo[]
  testigos: TestigosGeoResult
  /** Centro del municipio configurado. null = sin municipio elegido todavía. */
  centro: CentroMunicipio | null
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapaRef    = useRef<import('leaflet').Map | null>(null)
  const capaRef    = useRef<import('leaflet').FeatureGroup | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heatCapaRef = useRef<any>(null)
  const [vista, setVista] = useState<Vista>('residencia')
  const [ubicarPor, setUbicarPor] = useState<UbicarPor>('residencia')
  const [barrio, setBarrio] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Los barrios salen de los propios puntos: los que no tienen a nadie ubicado
  // no sirven de filtro acá, solo alargan la lista.
  const barrios = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of puntos) if (p.neighborhoodId) m.set(p.neighborhoodId, p.neighborhoodName ?? p.neighborhoodId)
    // También los que tienen polígono aunque no tengan a nadie ubicado: en la
    // vista "por barrio" se dibujan, así que hay que poder filtrar por ellos.
    for (const b of barriosGeo) m.set(b.id, b.name)
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [puntos, barriosGeo])

  // Filtrar en el cliente: los puntos ya están todos acá, así que acotar no
  // cuesta una consulta más y el mapa reencuadra solo sobre lo que queda.
  const visibles = useMemo(
    () => (barrio ? puntos.filter((p) => p.neighborhoodId === barrio) : puntos),
    [puntos, barrio],
  )
  const barriosVisibles = useMemo(
    () => (barrio ? barriosGeo.filter((b) => b.id === barrio) : barriosGeo),
    [barriosGeo, barrio],
  )
  const testigosVisibles = useMemo(
    () => (barrio ? testigos.testigos.filter((t) => t.neighborhoodId === barrio) : testigos.testigos),
    [testigos, barrio],
  )

  useEffect(() => {
    let cancelado = false
    void (async () => {
      // leaflet.heat es un plugin viejo escrito para <script> global (usa `L` a secas,
      // no importa leaflet) — hay que setear window.L ANTES de cargarlo, si no revienta
      // con "L is not defined". No sirve Promise.all: deben cargar en este orden exacto.
      const L = (await import('leaflet')).default
      if (vista === 'calor') {
        if (typeof window !== 'undefined') (window as unknown as { L: typeof L }).L = L
        await import('leaflet.heat')
      }
      if (cancelado || !contenedor.current) return

      if (!mapaRef.current) {
        // Arranca ya en el municipio de la campaña. Antes abría en Colombia
        // entera y solo se acercaba si había datos propios que encuadrar, así
        // que una campaña nueva veía el país aunque tuviera municipio elegido.
        const [inicio, zoom]: [[number, number], number] =
          centro ? [[centro.lat, centro.lng], ZOOM_MUNICIPIO] : VISTA_COLOMBIA
        mapaRef.current = L.map(contenedor.current).setView(inicio, zoom)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(mapaRef.current)
      }
      const mapa = mapaRef.current

      // Sacar la capa de la vista anterior (de cualquiera de los dos tipos) antes de dibujar la nueva.
      capaRef.current?.remove();     capaRef.current = null
      heatCapaRef.current?.remove(); heatCapaRef.current = null

      const centrarEnMunicipioSiVacio = () => {
        const puntosMunicipio: [number, number][] = [
          ...puestos.map((s): [number, number] => [s.lat, s.lng]),
          ...comunas.flatMap((c) => c.boundary),
        ]
        if (puntosMunicipio.length > 0) {
          mapa.fitBounds(L.latLngBounds(puntosMunicipio).pad(0.2))
        } else if (centro) {
          // Ni puestos ni comunas cargadas: al menos el municipio configurado.
          mapa.setView([centro.lat, centro.lng], ZOOM_MUNICIPIO)
        }
      }

      if (vista === 'calor') {
        const puntosHeat: [number, number, number][] = visibles.map((p) => [p.lat, p.lng, intensidadDeEstado(p.commitmentStatus)])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const heat = (L as any).heatLayer(puntosHeat, {
          radius: 35, blur: 25, maxZoom: 16, max: 1.0, gradient: GRADIENTE_CALOR,
        })
        heat.addTo(mapa)
        heatCapaRef.current = heat

        if (visibles.length > 0) mapa.fitBounds(L.latLngBounds(visibles.map((p): [number, number] => [p.lat, p.lng])).pad(0.2))
        else centrarEnMunicipioSiVacio()
      } else {
        const capa = L.featureGroup()
        if (vista === 'residencia')    dibujarCapaResidencia(L, capa, visibles)
        else if (vista === 'puesto')   dibujarCapaPuestos(L, capa, puestos)
        else if (vista === 'barrio')   dibujarCapaBarrios(L, capa, barriosVisibles, visibles)
        else if (vista === 'testigos') dibujarCapaTestigos(L, capa, testigosVisibles, ubicarPor)
        else                           dibujarCapaComunas(L, capa, comunas, visibles)
        capa.addTo(mapa)
        capaRef.current = capa

        if (capa.getLayers().length > 0) mapa.fitBounds(capa.getBounds().pad(0.2))
        else centrarEnMunicipioSiVacio()
      }
    })()

    return () => {
      cancelado = true
    }
  }, [vista, ubicarPor, visibles, puestos, comunas, barriosVisibles, testigosVisibles, centro])

  useEffect(() => () => {
    if (mapaRef.current) { mapaRef.current.remove(); mapaRef.current = null }
  }, [])

  function ubicar() {
    setMsg(null)
    startTransition(async () => {
      const res = await geocodificarPendientes()
      setMsg(`Ubicados ${res.geocodificados}. Quedan ${res.restantes} pendientes.`)
      router.refresh() // recarga los puntos del server component
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {(['residencia', 'puesto', 'comuna', 'barrio', 'testigos', 'calor'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            style={{
              background: vista === v ? '#0f172a' : '#f1f5f9',
              color:      vista === v ? '#fff' : '#475569',
              border: 'none', borderRadius: 999, padding: '0.35rem 0.9rem',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {ETIQUETA_VISTA[v]}
          </button>
        ))}

        {/* El filtro no aplica a "por puesto": esa vista dibuja puestos, no electores. */}
        {vista !== 'puesto' && barrios.length > 0 && (
          <select
            value={barrio}
            onChange={(e) => setBarrio(e.target.value)}
            title="Mostrar solo los electores de un barrio"
            style={{
              marginLeft: 'auto', border: '1px solid #cbd5e1', borderRadius: 999,
              padding: '0.3rem 0.7rem', fontSize: '0.8rem', background: '#fff',
              color: barrio ? '#0f172a' : '#64748b', maxWidth: 220,
            }}
          >
            <option value="">Todos los barrios</option>
            {barrios.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {vista === 'residencia' && <ControlesResidencia puntos={visibles} geoStats={geoStats} msg={msg} isPending={isPending} onUbicar={ubicar} />}
      {vista === 'puesto'     && <ControlesPuesto puestos={puestos} />}
      {vista === 'comuna'     && <ControlesComuna comunas={comunas} />}
      {vista === 'barrio'     && <ControlesBarrio barrios={barriosVisibles} />}
      {vista === 'testigos'   && <ControlesTestigos testigos={testigosVisibles} ubicarPor={ubicarPor} onUbicarPor={setUbicarPor} />}
      {vista === 'calor'      && <ControlesCalor puntos={visibles} />}

      <div
        ref={contenedor}
        style={{ height: 420, width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 0 }}
      />

      {vista === 'residencia' && puntos.length === 0 && geoStats.pendientes === 0 && (
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          Aún no hay electores con dirección para ubicar. Agrega direcciones al registrar electores.
        </p>
      )}
      {vista === 'puesto' && puestos.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          Aún no hay electores con mesa de votación asignada.
        </p>
      )}
      {vista === 'comuna' && comunas.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          Todavía no hay comunas con límites cargados para este municipio.
        </p>
      )}
      {vista === 'barrio' && barriosGeo.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          Todavía no hay barrios con límites cargados. Se importan igual que las comunas.
        </p>
      )}
      {vista === 'testigos' && testigos.testigos.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          Todavía no hay testigos. Se crean en Usuarios y testigos.
        </p>
      )}
      {vista === 'calor' && puntos.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          Aún no hay electores ubicados para calcular el mapa de calor.
        </p>
      )}
    </div>
  )
}

function ControlesResidencia({ puntos, geoStats, msg, isPending, onUbicar }: {
  puntos: VoterGeo[]; geoStats: GeoStats; msg: string | null; isPending: boolean; onUbicar: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
        {puntos.length} ubicados · {geoStats.pendientes} pendientes
      </span>
      {geoStats.pendientes > 0 && (
        <button
          onClick={onUbicar}
          disabled={isPending}
          style={{
            background: isPending ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none',
            padding: '0.4rem 0.9rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600,
            cursor: isPending ? 'wait' : 'pointer',
          }}
        >
          {isPending ? 'Ubicando…' : `Ubicar ${Math.min(5, geoStats.pendientes)} pendientes`}
        </button>
      )}
      {msg && <span style={{ fontSize: '0.8rem', color: '#166534' }}>{msg}</span>}
    </div>
  )
}

function ControlesPuesto({ puestos }: { puestos: StationGeo[] }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
        {puestos.length} puesto(s) con electores propios — verde: dentro de jurisdicción, rojo: fuera
      </span>
    </div>
  )
}

function ControlesCalor({ puntos }: { puntos: VoterGeo[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{puntos.length} elector(es) ubicados</span>
      {(['frio', 'tibio', 'caliente'] as const).map((t) => (
        <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#64748b' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_TEMPERATURA[t], display: 'inline-block' }} />
          {ETIQUETA_TEMPERATURA[t]}
        </span>
      ))}
    </div>
  )
}

function ControlesComuna({ comunas }: { comunas: ComunaGeo[] }) {
  const ordenadas = [...comunas].sort((a, b) => b.totalElectores - a.totalElectores)
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {ordenadas.map((c) => (
          <span
            key={c.id}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              background: '#f8fafc', color: '#334155', padding: '0.2rem 0.6rem',
              borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
            }}
          >
            {/* El punto es la leyenda: ata el nombre a su polígono en el mapa. */}
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color }} />
            {c.name}: {c.totalElectores}
          </span>
        ))}
      </div>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>
        Solo cuenta electores ya ubicados en el mapa (vista "por residencia").
      </p>
    </div>
  )
}

/**
 * Leyenda de testigos. Los que no tienen mesa son el dato accionable: son
 * capacidad disponible para cubrir las mesas que siguen descubiertas.
 */
function ControlesTestigos({ testigos, ubicarPor, onUbicarPor }: {
  testigos: TestigosGeoResult['testigos']
  ubicarPor: UbicarPor
  onUbicarPor: (u: UbicarPor) => void
}) {
  const conMesa = testigos.filter((t) => t.mesa).length
  const sinMesa = testigos.length - conMesa
  // Quiénes se quedan sin dibujar depende del modo: por casa, los sin dirección
  // geocodificada; por puesto, los sin mesa o cuyo puesto no está geocodificado.
  const sinUbicar = ubicarPor === 'puesto'
    ? testigos.filter((t) => t.puestoLat == null).length
    : testigos.filter((t) => t.lat == null).length

  return (
    <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', fontSize: '0.8rem' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#334155', fontWeight: 600 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR_TESTIGO.conMesa }} />
        Con mesa: {conMesa}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#334155', fontWeight: 600 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR_TESTIGO.sinMesa }} />
        Sin mesa: {sinMesa}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#64748b' }}>
        Ubicar por:
        {(['residencia', 'puesto'] as const).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => onUbicarPor(u)}
            style={{
              padding: '0.15rem 0.55rem', borderRadius: 999, border: '1px solid #e2e8f0', cursor: 'pointer',
              background: ubicarPor === u ? '#0f172a' : '#f1f5f9',
              color:      ubicarPor === u ? '#fff' : '#475569',
              fontWeight: 600,
            }}
          >
            {u === 'residencia' ? 'residencia' : 'puesto'}
          </button>
        ))}
      </span>
      {sinUbicar > 0 && (
        <span style={{ color: '#94a3b8' }}>
          {sinUbicar} {ubicarPor === 'puesto' ? 'sin puesto ubicable' : 'sin dirección ubicada'} — no salen en el mapa
        </span>
      )}
    </div>
  )
}

/**
 * Leyenda de barrios. Lleva la comuna en el chip porque hay nombres de barrio
 * que se repiten entre comunas, y sin eso dos chips iguales serían indistinguibles.
 */
function ControlesBarrio({ barrios }: { barrios: BarrioGeo[] }) {
  const ordenados = [...barrios].sort((a, b) => b.totalElectores - a.totalElectores)
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {ordenados.map((b) => (
          <span
            key={b.id}
            title={`${b.name} · ${b.comunaName}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              background: '#f8fafc', color: '#334155', padding: '0.2rem 0.6rem',
              borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: b.color }} />
            {b.name}: {b.totalElectores}
          </span>
        ))}
      </div>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>
        Cuenta los electores cuyo barrio ya se resolvió, aunque el filtro de arriba muestre otro.
      </p>
    </div>
  )
}
