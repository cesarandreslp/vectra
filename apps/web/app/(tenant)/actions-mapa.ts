'use server'

import { getTenantDb } from '@vectra/db'
import { requireModule } from '@/lib/auth-helpers'
import { getTenantConnection } from '@/lib/tenant'
import { buscarContorno } from '@/lib/geocode'
import { CARGOS_NACIONALES, CARGOS_DEPARTAMENTALES, CARGOS_MUNICIPALES, type LimiteMapa } from '@/lib/jurisdiccion'

/**
 * Contorno de la jurisdicción de la campaña, para que los mapas muestren solo
 * su territorio: municipio (alcalde, concejo), departamento (gobernación,
 * asamblea, cámara) o Colombia (senado, presidencia).
 *
 * La primera vez se trae de OpenStreetMap y se guarda en TenantConfig; después
 * sale de la DB. mapaLimiteClave lo invalida solo si cambia el cargo o el
 * territorio configurado. null = sin cargo o territorio: mapa sin acotar.
 */
export async function getLimiteMapa(): Promise<LimiteMapa | null> {
  const session  = await requireModule('CORE')
  const tenantId = session.user.tenantId
  const db       = getTenantDb(await getTenantConnection(tenantId))

  const cfg = await db.tenantConfig.findUnique({
    where:  { tenantId },
    select: {
      electionOffice: true, electionDepartmentCode: true, electionMunicipalityDivipola: true,
      mapaLimite: true, mapaLimiteClave: true,
    },
  })
  const cargo = cfg?.electionOffice
  if (!cfg || !cargo) return null

  // consultas: en orden, se usa la primera que devuelva contorno.
  let alcance: { clave: string; consultas: string[]; nombre: string; umbral: number } | null = null

  if (CARGOS_NACIONALES.includes(cargo)) {
    alcance = { clave: 'CO', consultas: ['Colombia'], nombre: 'Colombia', umbral: 0.02 }
  } else if (CARGOS_DEPARTAMENTALES.includes(cargo) && cfg.electionDepartmentCode) {
    const depto = await db.department.findUnique({ where: { code: cfg.electionDepartmentCode }, select: { name: true } })
    if (depto) alcance = { clave: `D:${cfg.electionDepartmentCode}`, consultas: [`${depto.name}, Colombia`], nombre: depto.name, umbral: 0.005 }
  } else if (CARGOS_MUNICIPALES.includes(cargo) && cfg.electionMunicipalityDivipola) {
    const muni = await db.municipality.findUnique({
      where:  { divipola: cfg.electionMunicipalityDivipola },
      select: { name: true, department: { select: { name: true } } },
    })
    // DIVIPOLA trae nombres como "BOGOTÁ. D.C." que OpenStreetMap no reconoce
    // (y en estos datos Bogotá cuelga de Cundinamarca): de respaldo, el nombre
    // sin el sufijo, sin tildes ("Bogotá" no aparece, "Bogota" sí) y solo el país.
    const limpio = muni?.name.replace(/[.,]?\s*D\.\s*C\.?\s*$/i, '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    if (muni && limpio) alcance = {
      clave:     `M:${cfg.electionMunicipalityDivipola}`,
      consultas: [`${muni.name}, ${muni.department.name}, Colombia`, `${limpio}, Colombia`],
      nombre:    muni.name,
      umbral:    0.001,
    }
  }
  if (!alcance) return null

  if (cfg.mapaLimiteClave === alcance.clave && cfg.mapaLimite) return cfg.mapaLimite as unknown as LimiteMapa

  let anillos: [number, number][][] | null = null
  for (const consulta of alcance.consultas) {
    anillos = await buscarContorno(consulta, alcance.umbral)
    if (anillos) break
  }
  if (!anillos) return null // best-effort: sin contorno el mapa queda sin acotar

  const limite: LimiteMapa = { nombre: alcance.nombre, anillos }
  await db.tenantConfig.update({
    where: { tenantId },
    data:  { mapaLimite: limite as unknown as object, mapaLimiteClave: alcance.clave },
  })
  return limite
}
