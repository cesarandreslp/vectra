/**
 * Votos de una mesa con claves canónicas, para comparar preconteo (E-14) y
 * escrutinio (E-24) sin depender de cómo se guardó cada uno:
 *   - id del candidato (las transmisiones viejas guardaban el NOMBRE: se resuelve)
 *   - votos_blanco / votos_nulos (en minúsculas, como los normaliza el Día E)
 */
export const CLAVE_BLANCO = 'votos_blanco'
export const CLAVE_NULOS  = 'votos_nulos'

export type Votos = Record<string, number>

interface FilaE14 { candidateId: string; votes: number }
interface TransmisionE14 { finalData: unknown; manualData: unknown; extractedData: unknown }

/** Lo mismo que usa la sala de situación: dato final, si no lo digitado, si no lo leído de la foto. */
export function datosDeTransmision(tx: TransmisionE14): FilaE14[] | null {
  return (tx.finalData ?? tx.manualData ?? tx.extractedData) as FilaE14[] | null
}

export function votosDeE14(filas: FilaE14[] | null, candidatos: { id: string; name: string }[]): Votos | null {
  if (!filas) return null
  const porClave = new Map<string, string>()
  for (const c of candidatos) {
    porClave.set(c.id.toLowerCase(), c.id)
    porClave.set(c.name.toLowerCase(), c.id)
  }
  const votos: Votos = {}
  for (const f of filas) {
    const k = f.candidateId.toLowerCase()
    const clave = k === CLAVE_BLANCO || k === CLAVE_NULOS ? k : porClave.get(k)
    if (clave) votos[clave] = (votos[clave] ?? 0) + (Number(f.votes) || 0)
  }
  return votos
}

export function totalVotos(v: Votos): number {
  return Object.values(v).reduce((a, n) => a + n, 0)
}

/** Claves cuyo valor cambió entre dos conteos (las que faltan valen 0). */
export function diferencias(antes: Votos, despues: Votos): { clave: string; antes: number; despues: number }[] {
  const claves = new Set([...Object.keys(antes), ...Object.keys(despues)])
  return [...claves]
    .map((clave) => ({ clave, antes: antes[clave] ?? 0, despues: despues[clave] ?? 0 }))
    .filter((d) => d.antes !== d.despues)
}
