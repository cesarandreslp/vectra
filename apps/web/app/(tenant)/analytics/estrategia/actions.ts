'use server'

/**
 * Agente semanal de estrategia: informes, "Analizar ahora" y deshacer.
 * La corrida en sí vive en lib/estrategia/agente (la comparte con el cron).
 */

import { revalidatePath } from 'next/cache'
import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { getTenantAiKeys } from '@/lib/tenant-ai'
import { correrAgente, deshacer, lunesColombia, traducir } from '@/lib/estrategia/agente'

export interface CorrectivoView {
  id:       string
  tipo:     string
  objetivo: string // nombre real
  cambio:   string // "120 → 150 votos", "a Pedro", el texto del aviso…
  motivo:   string
  estado:   'APLICADO' | 'RECHAZADO' | 'DESHECHO' | 'PROPUESTO'
  motivoRechazo: string | null
  deshacible: boolean
}

export interface AnalisisView {
  id:          string
  semana:      Date
  estado:      'OK' | 'ERROR'
  diagnostico: string | null
  prioridades: string[]
  error:       string | null
  correctivos: CorrectivoView[]
}

export interface EstrategiaView {
  modo:        'AUTONOMO' | 'SOLO_INFORME' | 'APAGADO'
  tieneClave:  boolean
  corrioEstaSemana: boolean
  analisis:    AnalisisView[] // el más reciente primero
}

async function contexto(accion: 'view' | 'edit' = 'view') {
  const roles = accion === 'edit' ? ['ADMIN_CAMPANA' as const] : ['ADMIN_CAMPANA' as const, 'COORDINADOR' as const]
  const session  = await requireModuleOrScreen('ANALYTICS', roles, 'ANALYTICS_ESTRATEGIA', accion)
  const tenantId = session.user.tenantId
  return { session, tenantId, db: getTenantDb(await getTenantConnection(tenantId)) }
}

export async function getEstrategia(): Promise<EstrategiaView> {
  const { tenantId, db } = await contexto()
  const [cfg, claves, analisis] = await Promise.all([
    db.tenantConfig.findUnique({ where: { tenantId }, select: { modoAgente: true } }),
    getTenantAiKeys(tenantId),
    db.analisisEstrategia.findMany({
      where: { tenantId }, orderBy: { semana: 'desc' }, take: 8,
      include: { correctivos: { orderBy: { createdAt: 'asc' } } },
    }),
  ])
  const semana = lunesColombia(new Date()).getTime()

  return {
    modo:       cfg?.modoAgente ?? 'AUTONOMO',
    tieneClave: Boolean(claves.anthropic),
    corrioEstaSemana: analisis.some((a) => a.semana.getTime() === semana && a.estado === 'OK'),
    analisis: analisis.map((a) => {
      const alias = (a.alias ?? {}) as Record<string, { id: string; nombre: string }>
      const nombreDe = new Map(Object.values(alias).map((v) => [v.id, v.nombre]))
      const nombre = (id: unknown) => (typeof id === 'string' ? nombreDe.get(id) ?? '—' : 'nadie')
      return {
        id: a.id, semana: a.semana, estado: a.estado, error: a.error,
        diagnostico: a.diagnostico ? traducir(a.diagnostico, alias) : null,
        prioridades: ((a.prioridades ?? []) as string[]).map((p) => traducir(p, alias)),
        correctivos: a.correctivos.map((c) => ({
          id: c.id, tipo: c.tipo, motivo: traducir(c.motivo, alias), estado: c.estado, motivoRechazo: c.motivoRechazo,
          objetivo: c.tipo === 'REASIGNAR_CONTACTO' ? 'Contacto de calle' : nombre(c.objetivoId),
          cambio: c.estado === 'RECHAZADO' ? '' : describir(c.tipo, c.antes, c.despues, nombre),
          deshacible: c.estado === 'APLICADO' && c.tipo !== 'AVISO',
        })),
      }
    }),
  }
}

function describir(tipo: string, antes: unknown, despues: unknown, nombre: (id: unknown) => string): string {
  if (tipo === 'META_LIDER' || tipo === 'META_COMUNA') return `${antes ?? 0} → ${despues} votos`
  if (tipo === 'REASIGNAR_CONTACTO') return `de ${nombre(antes)} a ${nombre(despues)}`
  return String(despues)
}

export async function analizarAhora(): Promise<{ ok: boolean; mensaje: string }> {
  const { tenantId, db } = await contexto('edit')
  const r = await correrAgente(db, tenantId)
  revalidatePath('/analytics/estrategia')
  switch (r.estado) {
    case 'ok':        return { ok: true, mensaje: `Listo: ${r.aplicados} correctivos válidos, ${r.rechazados} rechazados.` }
    case 'ya-corrio': return { ok: false, mensaje: 'El análisis de esta semana ya se hizo.' }
    case 'apagado':   return { ok: false, mensaje: 'El agente está apagado en Configuración.' }
    case 'sin-clave': return { ok: false, mensaje: 'Falta la clave de Claude (Anthropic) en Configuración.' }
    case 'error':     return { ok: false, mensaje: `Falló el análisis: ${r.error}` }
  }
}

/** Restaura el valor anterior, solo si nadie lo cambió después del agente. */
export async function deshacerCorrectivo(id: string): Promise<{ ok: boolean; mensaje: string }> {
  const { session, tenantId, db } = await contexto('edit')
  const r = await deshacer(db, tenantId, id, session.user.email ?? null)
  if (r.ok) revalidatePath('/analytics/estrategia')
  return r
}
