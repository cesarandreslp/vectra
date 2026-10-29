'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ConsultaAsistida } from './censo-asistido'

const boton: React.CSSProperties = { background: '#f1f5f9', color: '#475569', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', border: '1px solid #e2e8f0', cursor: 'pointer', textDecoration: 'none' }

/**
 * Cola de verificación para el equipo: recorre los electores sin resultado del
 * censo uno por uno. Cada uno reusa ConsultaAsistida; al guardar (o al Saltar)
 * pasa al siguiente. Pensada para computador con la extensión instalada, así
 * el elector o el líder en la calle solo registra y no verifica nada.
 */
export function ColaVerificacion({ electores }: { electores: { id: string; name: string }[] }) {
  const router = useRouter()
  const [i, setI] = useState(0)
  const actual = electores[i]

  // Siguiente tanda: el refresh excluye a los ya verificados; i vuelve al inicio.
  const recargar = () => { setI(0); router.refresh() }

  if (!actual) {
    const msg = electores.length === 0 ? 'No hay electores sin verificar.' : `Terminaste los ${electores.length} de esta tanda.`
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: '#475569', marginBottom: '1rem' }}>{msg}</div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          {electores.length > 0 && <button type="button" onClick={recargar} style={boton}>Cargar más</button>}
          <Link href="/core/electores" style={boton}>Volver a electores</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{i + 1} de {electores.length}</div>
        <button type="button" onClick={() => setI(i + 1)} style={boton}>Saltar →</button>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.6rem' }}>{actual.name}</div>
        <ConsultaAsistida key={actual.id} voterId={actual.id} onGuardado={() => setI(i + 1)} autoAbrir />
      </div>
    </div>
  )
}
