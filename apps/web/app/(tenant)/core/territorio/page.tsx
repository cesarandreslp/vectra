import { requireAuthOrRedirect } from '@/lib/auth-helpers'
import { listarDepartamentos }   from '../configuracion/actions'
import { getDefaultMunicipioDivipola, getMunicipalityByDivipola, listCommunes, listVotingStationsAdmin, getSede, getRepartoMeta } from './actions'
import { descuadreMetas }        from '@/lib/meta-votos'
import { listVoterOptions }        from '../actions'
import { SedePanel }               from './_components/sede-panel'
import { SelectorMunicipio }     from './_components/selector-municipio'
import { ComunasPanel }          from './_components/comunas-panel'
import { PuestosPanel }          from './_components/puestos-panel'
import { ImportarPanel }         from './_components/importar-panel'

export const metadata = { title: 'Territorio' }

interface Props {
  searchParams: Promise<{ municipio?: string }>
}

/** Administración territorial (comunas, corregimientos, barrios, puestos de votación) — solo ADMIN_CAMPANA/COORDINADOR. */
export default async function TerritorioPage({ searchParams }: Props) {
  await requireAuthOrRedirect(['ADMIN_CAMPANA', 'COORDINADOR'])
  const params = await searchParams
  const defaultDivipola = params.municipio ? null : await getDefaultMunicipioDivipola()
  const divipola = params.municipio ?? defaultDivipola ?? undefined

  const [departamentos, municipio] = await Promise.all([
    listarDepartamentos(),
    divipola ? getMunicipalityByDivipola(divipola) : Promise.resolve(null),
  ])

  const [comunas, puestos, electores, sede, reparto] = municipio
    ? await Promise.all([listCommunes(municipio.id), listVotingStationsAdmin(municipio.id), listVoterOptions(), getSede(), getRepartoMeta()])
    : [[], [], [], null, null]
  const descuadre = reparto && descuadreMetas(reparto.metaVotos, reparto.sumaComunas)

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>Territorio</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Comunas, corregimientos, barrios y puestos de votación de tu municipio.
      </p>

      <SelectorMunicipio
        departamentos={departamentos}
        departmentCodeSeleccionado={municipio?.departmentCode ?? ''}
        divipolaSeleccionado={divipola ?? ''}
      />

      {!municipio && divipola && (
        <p style={{ color: '#991b1b', fontSize: '0.875rem', marginTop: '1rem' }}>
          No se encontró ese municipio en la base territorial.
        </p>
      )}

      {municipio && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
          {sede && <SedePanel sede={sede} electores={electores} />}
          <ImportarPanel municipalityId={municipio.id} />
          {descuadre && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '0.6rem 0.9rem', borderRadius: 8 }}>
              ⚠ {descuadre} La meta de la campaña se edita en Configuración.
            </p>
          )}
          <ComunasPanel municipalityId={municipio.id} comunasIniciales={comunas} electores={electores} />
          <PuestosPanel municipalityId={municipio.id} puestosIniciales={puestos} />
        </div>
      )}
    </div>
  )
}
