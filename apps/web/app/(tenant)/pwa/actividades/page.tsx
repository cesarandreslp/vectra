'use client'

import { useCallback, useEffect, useState } from 'react'
import { misActividades, electoresParaAsignar, type MiActividad } from './actions'
import { PanelMisActividades } from './_components/panel-mis-actividades'

export default function PwaActividadesPage() {
  const [actividades, setActividades] = useState<MiActividad[] | null>(null)
  const [electores, setElectores] = useState<{ id: string; name: string; esSimpatizante: boolean }[]>([])

  const cargar = useCallback(() => { void misActividades().then(setActividades) }, [])
  useEffect(() => {
    cargar()
    void electoresParaAsignar().then(setElectores)
  }, [cargar])

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Mis actividades</h1>
      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem' }}>
        Las actividades donde vos respondés. Armá los grupos por lugar, sumá simpatizantes y cargá lo que hace falta.
      </p>

      {actividades === null && <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.875rem' }}>Cargando...</div>}
      {actividades !== null && actividades.length === 0 && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
          No sos doliente de ninguna actividad. Cuando la campaña te asigne una, aparece acá.
        </div>
      )}
      {actividades !== null && actividades.length > 0 && (
        <PanelMisActividades actividades={actividades} electores={electores} onChange={cargar} />
      )}
    </div>
  )
}
