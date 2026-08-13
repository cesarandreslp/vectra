'use client'

/**
 * Estudios: nivel, "¿en qué?" cuando el nivel lo amerita, posgrado como pregunta
 * aparte (no como nivel: alguien es profesional en X *y además* magíster en Y) y
 * certificaciones.
 */

import { useId } from 'react'
import {
  NIVELES, POSGRADOS, NIVELES_CON_TITULO, ETIQUETA_NIVEL, ETIQUETA_POSGRADO,
  type Nivel, type Posgrado,
} from '@/lib/perfil'
import { SelectorEtiquetas } from './selector-etiquetas'

const input = { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.45rem 0.6rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' as const }
const lbl = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.2rem' }

export function BloqueEstudios({ nivel, tituloEn, posgrado, posgradoEn, certificaciones, titulos, opcionesCertificaciones, onChange }: {
  nivel: Nivel | null
  tituloEn: string | null
  posgrado: Posgrado | null
  posgradoEn: string | null
  certificaciones: string[]
  /** Áreas ya usadas en la campaña, para el desplegable de "¿en qué?". */
  titulos: string[]
  opcionesCertificaciones: string[]
  onChange: (campo: 'nivelEducativo' | 'tituloEn' | 'posgrado' | 'posgradoEn' | 'certificaciones', valor: unknown) => void
}) {
  const listaTitulos = useId()
  const pideTitulo = nivel !== null && NIVELES_CON_TITULO.includes(nivel)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      <datalist id={listaTitulos}>
        {titulos.map((t) => <option key={t} value={t} />)}
      </datalist>

      <div>
        <label style={lbl}>Estudios</label>
        <select
          value={nivel ?? ''}
          onChange={(e) => onChange('nivelEducativo', e.target.value || null)}
          style={input}
        >
          <option value="">sin especificar</option>
          {NIVELES.map((n) => <option key={n} value={n}>{ETIQUETA_NIVEL[n]}</option>)}
        </select>
      </div>

      {pideTitulo && (
        <div>
          <label style={lbl}>¿En qué? ({ETIQUETA_NIVEL[nivel]})</label>
          <input
            list={listaTitulos} value={tituloEn ?? ''}
            onChange={(e) => onChange('tituloEn', e.target.value)}
            placeholder="Elegí de la lista o escribí el tuyo" style={input}
          />
        </div>
      )}

      <div>
        <label style={lbl}>¿Tenés posgrado?</label>
        <select
          value={posgrado ?? ''}
          onChange={(e) => onChange('posgrado', e.target.value || null)}
          style={input}
        >
          <option value="">no</option>
          {POSGRADOS.map((n) => <option key={n} value={n}>{ETIQUETA_POSGRADO[n]}</option>)}
        </select>
      </div>

      {posgrado && (
        <div>
          <label style={lbl}>¿En qué? ({ETIQUETA_POSGRADO[posgrado]})</label>
          <input
            list={listaTitulos} value={posgradoEn ?? ''}
            onChange={(e) => onChange('posgradoEn', e.target.value)}
            placeholder="Elegí de la lista o escribí el tuyo" style={input}
          />
        </div>
      )}

      <div>
        <label style={lbl}>¿Tenés certificaciones? ¿En qué?</label>
        <SelectorEtiquetas
          valor={certificaciones} opciones={opcionesCertificaciones}
          onChange={(v) => onChange('certificaciones', v)}
          placeholder="Ej: manipulación de alimentos"
        />
      </div>
    </div>
  )
}
