/**
 * Automatizaciones: un evento (alta de elector, cambio de compromiso) o una
 * fecha (recordatorio, día E) deja mensajes en la cola —filas de Message con
 * reglaId + programadoPara— y el cron las despacha. Un solo camino de envío.
 * La fila es única por (regla, persona): cada regla le llega una sola vez a
 * cada quien, aunque el evento se repita o el cron corra cien veces.
 *
 * Canales: PUSH a la app del elector y WHATSAPP con plantilla aprobada en Meta
 * (WhatsApp no deja escribirle primero a nadie con texto libre).
 */

import { decrypt, type getTenantDb } from '@vectra/db'
import { sendMessage } from '@vectra/messaging'
import { enviarPushAVoters, getVapidPublicKey } from './push'
import { aplicaCambio, renderPlantilla, tocaHoy, diaEleccion } from './automatizaciones-reglas'

type Db = ReturnType<typeof getTenantDb>
interface Regla { id: string; channel: string; delayMinutes: number; conditions: unknown }

const LOTE = 200 // por campaña y corrida (cada 5 min): WhatsApp limita la tasa de envío

/** Deja en la cola una regla para estos electores. No envía: eso lo hace el cron. */
async function encolar(db: Db, tenantId: string, regla: Regla, voterIds: string[] | 'TODOS', programadoPara: Date) {
  const base = { tenantId, status: 'ACTIVO' as const, ...(voterIds !== 'TODOS' && { id: { in: voterIds } }) }
  // Solo a quien el canal le puede llegar: si no, la fila nace muerta.
  const where = regla.channel === 'PUSH'
    ? { ...base, pushSubscriptions: { some: {} } }
    : { ...base, phone: { not: null } }
  const voters = await db.voter.findMany({ where, select: { id: true } })
  for (let i = 0; i < voters.length; i += 1000) {
    await db.message.createMany({
      data: voters.slice(i, i + 1000).map((v) => ({
        tenantId, channel: regla.channel, recipientId: v.id, recipientType: 'VOTER',
        body: '', status: 'PENDIENTE', reglaId: regla.id, programadoPara,
      })),
      skipDuplicates: true,
    })
  }
}

/**
 * Un evento sobre electores. Nunca lanza: un aviso que no se pudo encolar no
 * puede tumbar el registro de una persona.
 */
export async function encolarEvento(
  db: Db, tenantId: string, trigger: 'NUEVO_ELECTOR' | 'CAMBIO_COMPROMISO',
  voterIds: (string | null | undefined)[], estadoNuevo?: string,
): Promise<void> {
  const ids = [...new Set(voterIds.filter((v): v is string => Boolean(v)))]
  if (!ids.length) return
  try {
    const reglas = await db.automationRule.findMany({ where: { tenantId, trigger, isActive: true } })
    for (const r of reglas) {
      if (trigger === 'CAMBIO_COMPROMISO' && !aplicaCambio(r.conditions, estadoNuevo ?? '')) continue
      await encolar(db, tenantId, r, ids, new Date(Date.now() + r.delayMinutes * 60_000))
    }
  } catch (err) {
    console.error(`[AUTOMATIZACIONES] No se pudo encolar ${trigger}:`, err instanceof Error ? err.message : err)
  }
}

/** Corrida del cron para una campaña: encola lo que toca por fecha y despacha lo vencido. */
export async function despacharCola(db: Db, tenantId: string, ahora = new Date()): Promise<{ enviados: number; fallidos: number }> {
  const config = await db.tenantConfig.findUnique({
    where: { tenantId }, select: { fechaEleccion: true, whatsappToken: true, whatsappPhoneId: true },
  })

  const porFecha = await db.automationRule.findMany({ where: { tenantId, isActive: true, trigger: { in: ['DIA_ELECCION', 'RECORDATORIO_VOTO'] } } })
  for (const r of porFecha) {
    if (tocaHoy(r.trigger, r.conditions, config?.fechaEleccion ?? null, ahora)) await encolar(db, tenantId, r, 'TODOS', ahora)
  }

  const vencidos = await db.message.findMany({
    where:   { tenantId, reglaId: { not: null }, status: 'PENDIENTE', programadoPara: { lte: ahora } },
    orderBy: { programadoPara: 'asc' },
    take:    LOTE,
    select:  { id: true, reglaId: true, recipientId: true },
  })
  if (!vencidos.length) return { enviados: 0, fallidos: 0 }

  const reglas = await db.automationRule.findMany({ where: { id: { in: [...new Set(vencidos.map((m) => m.reglaId!))] } } })
  const plantillas = await db.messageTemplate.findMany({ where: { id: { in: reglas.map((r) => r.templateId) } } })
  const voters = await db.voter.findMany({
    where:  { id: { in: vencidos.map((m) => m.recipientId) } },
    select: {
      id: true, name: true, apodo: true, phone: true, status: true,
      leader: { select: { name: true } }, votingTable: { select: { number: true, station: { select: { name: true } } } },
    },
  })
  const candidato = (await db.voter.findFirst({ where: { tenantId, isCandidate: true }, select: { name: true } }))?.name ?? ''
  const fecha = config?.fechaEleccion
    ? new Date(`${diaEleccion(config.fechaEleccion)}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    : ''
  const reglaDe = new Map(reglas.map((r) => [r.id, r]))
  const plantillaDe = new Map(plantillas.map((p) => [p.id, p]))
  const voterDe = new Map(voters.map((v) => [v.id, v]))
  const wa = config?.whatsappToken && config.whatsappPhoneId
    ? { token: decrypt(config.whatsappToken), phoneNumberId: config.whatsappPhoneId } : null

  let enviados = 0, fallidos = 0
  for (const m of vencidos) {
    // Se toma antes de enviar: si dos corridas se pisan, solo una lo manda.
    const tomado = await db.message.updateMany({ where: { id: m.id, status: 'PENDIENTE' }, data: { status: 'ENVIANDO' } })
    if (!tomado.count) continue

    const regla = reglaDe.get(m.reglaId!)
    const plantilla = regla && plantillaDe.get(regla.templateId)
    const v = voterDe.get(m.recipientId)
    const datos: Record<string, string> = v ? {
      nombre: v.apodo?.trim() || v.name, lider: v.leader?.name ?? '', candidato,
      puesto: v.votingTable?.station.name ?? '', mesa: v.votingTable ? String(v.votingTable.number) : '', fecha_eleccion: fecha,
    } : {}
    const subject = plantilla?.subject ? renderPlantilla(plantilla.subject, datos) : null
    const body = plantilla ? renderPlantilla(plantilla.body, datos) : ''

    let error: string | null = null
    let providerMsgId: string | null = null
    if (!regla?.isActive || !plantilla?.isActive) error = 'La regla o su plantilla se apagó antes del envío.'
    else if (!v || v.status !== 'ACTIVO') error = 'El elector ya no está activo.'
    else if (regla.channel === 'PUSH') {
      if (!getVapidPublicKey()) error = 'Las notificaciones push no están configuradas en el servidor.'
      else await enviarPushAVoters(db, tenantId, [v.id], { title: subject || 'Mensaje de la campaña', body, url: '/pwa' })
    } else if (regla.channel === 'WHATSAPP') {
      if (!wa) error = 'WhatsApp no está conectado.'
      else if (!plantilla.whatsappPlantilla) error = 'La plantilla no tiene asociada una plantilla aprobada en Meta.'
      else if (!v.phone) error = 'El elector no tiene celular.'
      else {
        const r = await sendMessage({
          to: decrypt(v.phone), channel: 'WHATSAPP', body,
          templateName: plantilla.whatsappPlantilla, templateParams: plantilla.whatsappVariables.map((k) => datos[k] ?? ''),
        }, undefined, wa)
        if (r.success) providerMsgId = r.providerMsgId ?? null
        else error = r.error ?? 'WhatsApp rechazó el mensaje.'
      }
    } else error = `Canal ${regla.channel} no disponible para automatizaciones.`

    await db.message.update({
      where: { id: m.id },
      data: {
        status: error ? 'FALLIDO' : 'ENVIADO', failReason: error, subject, body,
        to: regla?.channel === 'WHATSAPP' ? v?.phone ?? null : null, // ya va cifrado
        provider: error ? null : regla!.channel === 'PUSH' ? 'web-push' : 'whatsapp-meta',
        providerMsgId, sentAt: error ? null : new Date(),
      },
    })
    if (error) fallidos++
    else enviados++
  }
  return { enviados, fallidos }
}
