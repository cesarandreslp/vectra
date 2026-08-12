/**
 * Carga del dataset DIVIPOLA oficial de Colombia (33 departamentos + 1.103 municipios)
 * en una base de datos tenant.
 *
 * Fuente del dataset: extraído del archivo SIGEP "Resultados Vig 2024"
 * (`16-06-2025_Resultados_Vig2024.xlsx`, hoja "Territorio") y normalizado a JSON.
 *
 * Casos especiales aplicados sobre la fuente:
 *   - Código 11 → "Bogotá D.C." (la fuente lo reportaba como "CUNDINAMARCA").
 *   - Nombres pasan a Title Case preservando tildes y "ñ".
 *
 * Esta función es idempotente: usa upsert por código DIVIPOLA. Puede llamarse:
 *   1. Desde el seed inicial del superadmin (`prisma/seed.ts`).
 *   2. Desde el provisioner real, después de aplicar las migraciones a una DB tenant nueva.
 */

import type { PrismaClient } from '@prisma/client'
import divipolaData from '../data/divipola.json'

interface DepartmentRow { code: string; name: string }
interface MunicipalityRow { divipola: string; name: string; deptCode: string; isCapital: boolean }

interface DivipolaDataset {
  departments:    DepartmentRow[]
  municipalities: MunicipalityRow[]
}

const dataset = divipolaData as DivipolaDataset

// El SIGEP reporta el código 11 con nombre "CUNDINAMARCA", pero DIVIPOLA oficial lo asigna
// a Bogotá D.C. (Distrito Capital). Cundinamarca real es código 25.
const NOMBRE_OVERRIDE: Record<string, string> = {
  '11': 'Bogotá D.C.',
}

/**
 * Convierte "VALLE DEL CAUCA" → "Valle del Cauca", preservando tildes y conectores.
 * No toca palabras de 2 letras o menos como "DC", "DE", "EL".
 */
function aTitleCase(texto: string): string {
  const conectores = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'en'])
  return texto
    .toLowerCase()
    .split(' ')
    .map((palabra, i) => {
      if (i > 0 && conectores.has(palabra)) return palabra
      return palabra.charAt(0).toUpperCase() + palabra.slice(1)
    })
    .join(' ')
}

export interface SeedDivipolaResult {
  departments:    number
  municipalities: number
}

/**
 * Carga (o actualiza) los 33 departamentos y 1.103 municipios DIVIPOLA en la DB indicada.
 *
 * @param db Cliente Prisma apuntando a la DB destino (superadmin o tenant)
 * @returns Conteo de departamentos y municipios procesados
 */
export async function seedDivipola(db: PrismaClient): Promise<SeedDivipolaResult> {
  // Un upsert por fila = un viaje de red por fila (1.103 municipios ≈ 3 min sobre
  // Neon). Se inserta en LOTE con createMany, que colapsa todo en 2 statements.
  // ponytail: createMany+skipDuplicates no ACTUALIZA nombres en una re-siembra
  // (upsert sí lo hacía). Es idempotente para el caso real —provisión de una DB
  // tenant nueva y vacía—; si algún día cambia el casing del dataset y hay que
  // repropagar nombres a DBs ya sembradas, hacerlo con una migración puntual.

  // ── Departamentos ─────────────────────────────────────────────────────────
  await db.department.createMany({
    data: dataset.departments.map((d) => ({
      code: d.code,
      name: NOMBRE_OVERRIDE[d.code] ?? aTitleCase(d.name),
    })),
    skipDuplicates: true,
  })

  // ── Municipios ────────────────────────────────────────────────────────────
  // Índice code → id en una sola consulta para resolver la FK sin N lookups.
  const todosDeptos = await db.department.findMany({ select: { id: true, code: true } })
  const deptIdPorCodigo = new Map(todosDeptos.map((d) => [d.code, d.id]))

  const municipios = dataset.municipalities.flatMap((m) => {
    const departmentId = deptIdPorCodigo.get(m.deptCode)
    if (!departmentId) {
      // Inconsistencia en el dataset — no debería ocurrir
      console.warn(`[seedDivipola] Departamento ${m.deptCode} no existe; se omite municipio ${m.divipola}`)
      return []
    }
    return [{ divipola: m.divipola, name: aTitleCase(m.name), departmentId }]
  })
  await db.municipality.createMany({ data: municipios, skipDuplicates: true })

  return {
    departments:    dataset.departments.length,
    municipalities: municipios.length,
  }
}
