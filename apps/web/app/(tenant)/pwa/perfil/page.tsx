'use client'

import { useEffect, useState } from 'react'
import { getMiPerfil, type MiPerfil } from './actions'
import { FormPerfil } from './_components/form-perfil'

export default function PwaPerfilPage() {
  const [perfil, setPerfil] = useState<MiPerfil | null | undefined>(undefined)

  useEffect(() => { void getMiPerfil().then(setPerfil) }, [])

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Mi perfil</h1>
      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem' }}>
        Contá qué sabés hacer y cuándo podés. Así, cuando la campaña arme una actividad, sabe a quién llamar.
      </p>

      {perfil === undefined && <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>Cargando...</div>}
      {perfil === null && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
          Esta pantalla es para electores registrados en la campaña.
        </div>
      )}
      {perfil && <FormPerfil inicial={perfil} />}
    </div>
  )
}
