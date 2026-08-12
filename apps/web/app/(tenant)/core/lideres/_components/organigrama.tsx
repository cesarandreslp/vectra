import Link from 'next/link'
import type { NodoOrganizacion } from '../../actions'
import { TITULOS } from '@/lib/lideres'

/**
 * Organigrama visual (no lista con sangría) — cajas conectadas por líneas,
 * técnica clásica de CSS puro con <ul>/<li> (cada <li> aporta su tramo de
 * la barra horizontal vía border-top, recortada a la mitad en el primer y
 * último hermano para que la barra quede exacta entre extremos).
 */
export function Organigrama({ raiz }: { raiz: NodoOrganizacion }) {
  return (
    <div style={{ overflowX: 'auto', padding: '0.5rem 0' }}>
      <style>{ESTILOS}</style>
      <ul className="organigrama-vectra">
        <NodoOrganigrama nodo={raiz} esRaiz />
      </ul>
    </div>
  )
}

function NodoOrganigrama({ nodo, esRaiz = false }: { nodo: NodoOrganizacion; esRaiz?: boolean }) {
  return (
    <li>
      <Link
        href={`/core/lideres/${nodo.id}`}
        style={{
          display: 'inline-block', textDecoration: 'none', textAlign: 'left',
          background: esRaiz ? '#0f172a' : '#fff',
          color:      esRaiz ? '#fff' : '#0f172a',
          border:       `1px solid ${esRaiz ? '#0f172a' : '#e2e8f0'}`,
          borderRadius: '8px',
          padding:      '0.6rem 0.9rem',
          minWidth:     '140px',
          boxShadow:    '0 1px 2px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{nodo.name}</div>
        {nodo.zone && (
          <div style={{ fontSize: '0.7rem', opacity: 0.75, marginTop: '1px' }}>{nodo.zone}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.3rem' }}>
          <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>
            {nodo.directos} directos · {nodo.red} en red
          </span>
          {nodo.titulos.map((t) => (
            <span key={t} title={TITULOS[t].descripcion} style={{
              background: esRaiz ? 'rgba(255,255,255,0.15)' : `${TITULOS[t].color}1a`,
              color:      esRaiz ? '#fff' : TITULOS[t].color,
              padding: '0.05rem 0.4rem', borderRadius: 999, fontSize: '0.6rem', fontWeight: 700,
              whiteSpace: 'nowrap',
            }}>
              {TITULOS[t].nombre.toUpperCase()}
            </span>
          ))}
        </div>
      </Link>

      {nodo.children.length > 0 && (
        <ul>
          {nodo.children.map((hijo) => (
            <NodoOrganigrama key={hijo.id} nodo={hijo} />
          ))}
        </ul>
      )}
    </li>
  )
}

// Técnica de organigrama con CSS puro (ul/li + border como conectores).
// Ver referencia: cualquier "pure css org chart" — es el patrón estándar.
const ESTILOS = `
.organigrama-vectra, .organigrama-vectra ul {
  display: flex;
  justify-content: center;
  padding-top: 20px;
  position: relative;
}
.organigrama-vectra { padding-top: 0; }
.organigrama-vectra li {
  display: flex;
  flex-direction: column;
  align-items: center;
  list-style-type: none;
  position: relative;
  padding: 20px 10px 0 10px;
}
.organigrama-vectra li::before, .organigrama-vectra li::after {
  content: '';
  position: absolute;
  top: 0;
  right: 50%;
  width: 50%;
  height: 20px;
  border-top: 2px solid #cbd5e1;
}
.organigrama-vectra li::after {
  right: auto;
  left: 50%;
  border-left: 2px solid #cbd5e1;
}
.organigrama-vectra li:only-child::before, .organigrama-vectra li:only-child::after {
  display: none;
}
.organigrama-vectra li:only-child { padding-top: 0; }
.organigrama-vectra li:first-child::before, .organigrama-vectra li:last-child::after {
  border: 0 none;
}
.organigrama-vectra li:last-child::before {
  border-right: 2px solid #cbd5e1;
  border-radius: 0 6px 0 0;
}
.organigrama-vectra li:first-child::after {
  border-radius: 6px 0 0 0;
}
.organigrama-vectra ul ul::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 0;
  height: 20px;
  border-left: 2px solid #cbd5e1;
}
.organigrama-vectra > li { padding-top: 0; }
.organigrama-vectra > li::before, .organigrama-vectra > li::after { display: none; }
`
