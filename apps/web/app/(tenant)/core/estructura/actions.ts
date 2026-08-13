'use server'

/**
 * Vista compuesta de la estructura humana de la campaña (solo lectura).
 * No modela nada nuevo: junta lo que ya vive repartido —cargo/sede en
 * TenantConfig, líderes en Commune/Neighborhood, staff en User, tesorero en
 * FinanceConfig— para verlo en una pantalla. Cada bloque se edita en su sitio.
 */

import { requireModuleOrScreen } from '@/lib/auth-helpers'
import { superadminDb, getTenantDb } from '@vectra/db'
import { getTenantConnection } from '@/lib/tenant'
import { type UserRole } from '@vectra/auth'

const CARGO_LABEL: Record<string, string> = {
  ALCALDE: 'Alcalde/Alcaldesa', CONCEJAL: 'Concejal', GOBERNADOR: 'Gobernador/Gobernadora',
  DIPUTADO: 'Diputado', REPRESENTANTE: 'Representante a la Cámara',
  SENADOR: 'Senador/Senadora', PRESIDENTE: 'Presidente',
}

const ROL_LABEL: Record<string, string> = {
  ADMIN_CAMPANA: 'Admin campaña', COORDINADOR: 'Coordinador',
  LIDER: 'Líder', TESTIGO: 'Testigo', PERSONALIZADO: 'Personalizado',
}

// Roles de cumplimiento del primer anillo: no son roles fijos del sistema, se
// arman como rol personalizado. Detectamos al jurídico por el nombre del rol.
const JURIDICO_RE = /jur[íi]dic|abogad|asesor.*legal|\blegal\b/i

export interface EstructuraView {
  candidato:      { nombre: string; cargo: string | null }
  tesorero:       { nombre: string | null } | null // null si FINANZAS no está activo
  asesorJuridico: string | null // nombre del staff con rol jurídico, o null (sugerido)
  sede:           { nombre: string | null; direccion: string | null; lider: string | null }
  territorio:     { comunas: number; comunasConLider: number; barrios: number; barriosConLider: number }
  staff:          { email: string; nombre: string | null; rol: string; activo: boolean }[]
}

export async function getEstructura(): Promise<EstructuraView> {
  const session  = await requireModuleOrScreen('CORE', ['ADMIN_CAMPANA', 'COORDINADOR'], 'CORE_ESTRUCTURA')
  const tenantId = session.user.tenantId
  const db       = getTenantDb(await getTenantConnection(tenantId))

  const [cfg, financeCfg, comunas, comunasConLider, barrios, barriosConLider, usuarios] = await Promise.all([
    db.tenantConfig.findUnique({ where: { tenantId } }),
    session.user.activeModules.includes('FINANZAS')
      ? db.financeConfig.findUnique({ where: { tenantId } })
      : Promise.resolve(null),
    db.commune.count(),
    db.commune.count({ where: { liderId: { not: null } } }),
    db.neighborhood.count(),
    db.neighborhood.count({ where: { liderId: { not: null } } }),
    superadminDb.user.findMany({
      where:   { tenantId },
      include: { customRole: { select: { name: true } } },
      orderBy: [{ isActive: 'desc' }, { email: 'asc' }],
    }),
  ])

  // El líder de sede es un Voter; su nombre vive en la DB del tenant.
  let sedeLider: string | null = null
  if (cfg?.sedeLiderId) {
    const v = await db.voter.findUnique({ where: { id: cfg.sedeLiderId }, select: { name: true } })
    sedeLider = v?.name ?? null
  }

  // ¿Ya hay un asesor jurídico? Buscamos un staff cuyo rol personalizado suene a jurídico.
  const jur = usuarios.find((u) => u.customRole?.name && JURIDICO_RE.test(u.customRole.name))

  return {
    candidato: {
      nombre: session.user.tenantName ?? 'Campaña',
      cargo:  cfg?.electionOffice ? CARGO_LABEL[cfg.electionOffice] ?? cfg.electionOffice : null,
    },
    tesorero:       session.user.activeModules.includes('FINANZAS') ? { nombre: financeCfg?.nombreTesorero ?? null } : null,
    asesorJuridico: jur ? (jur.name ?? jur.email) : null,
    sede:       { nombre: cfg?.sedeNombre ?? null, direccion: cfg?.sedeDireccion ?? null, lider: sedeLider },
    territorio: { comunas, comunasConLider, barrios, barriosConLider },
    staff: usuarios.map((u) => ({
      email:  u.email,
      nombre: u.name,
      rol:    u.role === 'PERSONALIZADO' ? (u.customRole?.name ?? 'Personalizado') : (ROL_LABEL[u.role as UserRole] ?? u.role),
      activo: u.isActive,
    })),
  }
}
