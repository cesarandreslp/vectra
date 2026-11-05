/**
 * Respaldo diario de todas las bases (superadmin y campañas) con ramas de Neon.
 * Una rama es una foto de la base en ese instante, sin compute: no cuesta
 * mientras nadie la abra. El plan actual de Neon solo deja volver 6 horas
 * atrás; con esto se puede volver a cualquiera de los últimos 7 días.
 * Restaurar: en la consola de Neon, desde la rama "respaldo-AAAA-MM-DD".
 *
 * Corre dentro del cron de 5 min; solo trabaja una vez al día por proyecto
 * (si ya existe la rama de hoy, no hace nada).
 */

import { diaColombia } from './automatizaciones-reglas'

const API = 'https://console.neon.tech/api/v2'
const PREFIJO = 'respaldo-'
const CONSERVAR_DIAS = 7

async function neon<T>(ruta: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.NEON_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Neon ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json() as Promise<T>
}

/** Las ramas de respaldo que sobran: las de más de N días (por la fecha del nombre). */
export function ramasViejas(nombres: string[], hoy: string, dias = CONSERVAR_DIAS): string[] {
  const limite = new Date(Date.parse(`${hoy}T00:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10)
  return nombres.filter((n) => n.startsWith(PREFIJO) && /^\d{4}-\d{2}-\d{2}$/.test(n.slice(PREFIJO.length)) && n.slice(PREFIJO.length) <= limite)
}

// Día ya respaldado en esta instancia: evita consultar a Neon cada 5 min. Si la
// instancia es nueva, la consulta vuelve a ver que la rama de hoy existe y sigue.
let diaHecho = ''

export async function respaldoDiario(ahora = new Date()): Promise<Record<string, string>> {
  if (!process.env.NEON_API_KEY) return { estado: 'sin NEON_API_KEY' }
  const hoy = diaColombia(ahora)
  if (diaHecho === hoy) return {}
  const resultado: Record<string, string> = {}
  const { projects } = await neon<{ projects: { id: string; name: string }[] }>('/projects?limit=100')
  for (const p of projects) {
    try {
      const { branches } = await neon<{ branches: { id: string; name: string }[] }>(`/projects/${p.id}/branches`)
      if (branches.some((b) => b.name === `${PREFIJO}${hoy}`)) continue
      await neon(`/projects/${p.id}/branches`, { method: 'POST', body: JSON.stringify({ branch: { name: `${PREFIJO}${hoy}` } }) })
      const viejas = ramasViejas(branches.map((b) => b.name), hoy)
      for (const b of branches.filter((x) => viejas.includes(x.name))) await neon(`/projects/${p.id}/branches/${b.id}`, { method: 'DELETE' })
      resultado[p.name] = `respaldo ${hoy}${viejas.length ? ` · ${viejas.length} viejo(s) borrado(s)` : ''}`
    } catch (err) {
      resultado[p.name] = `ERROR: ${err instanceof Error ? err.message : err}`
      console.error(`[RESPALDOS] ${p.name}:`, err)
    }
  }
  if (!Object.values(resultado).some((r) => r.startsWith('ERROR'))) diaHecho = hoy
  return resultado
}
