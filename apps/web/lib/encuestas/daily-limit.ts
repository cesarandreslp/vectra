import { getTenantDb } from '@vectra/db'

export class DailyLimitService {
  /**
   * Retorna cuántos mensajes iniciados quedan disponibles hoy para un tenant.
   */
  async getRemainingCapacity(tenantDb: ReturnType<typeof getTenantDb>, limit: number): Promise<number> {
    // Calcular inicio y fin del día en hora local (Bogotá UTC-5)
    // Para simplificar, usamos UTC - 5 horas directamente
    const now = new Date()
    // Convertir a hora de Bogotá
    const bogotaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const startOfDay = new Date(bogotaTime)
    startOfDay.setHours(0, 0, 0, 0)
    
    // Restaurar a UTC para hacer la consulta
    const startOfBogotaDayUTC = new Date(startOfDay.getTime() + 5 * 60 * 60 * 1000)
    const endOfBogotaDayUTC = new Date(startOfBogotaDayUTC.getTime() + 24 * 60 * 60 * 1000)

    const contacted = await tenantDb.voter.count({
      where: {
        surveyContactDate: {
          gte: startOfBogotaDayUTC,
          lt: endOfBogotaDayUTC,
        },
      },
    })

    const remaining = Math.max(0, limit - contacted)
    console.log(`[DAILY-LIMIT] Today: ${contacted}/${limit} contacted. Remaining capacity: ${remaining}`)
    
    return remaining
  }
}

export const dailyLimitService = new DailyLimitService()
