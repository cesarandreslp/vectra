/**
 * Cierre de una campaña (Ley 1581: los datos se tratan mientras dura la
 * finalidad y después se suprimen). Dos piezas, ambas solo para el superadmin:
 *
 *  1. padronCsv: la copia que se entrega a la campaña, que es la responsable.
 *  2. suprimirDatosCampana: anonimiza a todos los electores (menos el candidato)
 *     y borra lo personal de las tablas auxiliares, en UNA transacción.
 *
 * Se CONSERVA: finanzas (Ley 1475: la campaña rinde cuentas al CNE después de
 * la elección), resultados electorales (E-14, escrutinio: no son datos de
 * personas), y la prueba de las autorizaciones y solicitudes de titulares
 * (revocadas), que es lo que se muestra ante la SIC. Borrar el proyecto de
 * Neon entero es un paso manual posterior, cuando venza la obligación legal.
 */

import { decrypt, type getTenantDb } from '@vectra/db'

type Db = ReturnType<typeof getTenantDb>

const csv = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const claro = (c: string | null) => { if (!c) return ''; try { return decrypt(c) } catch { return '(ilegible)' } }

/** CSV con BOM (Excel lo abre con tildes) de todo el padrón, descifrado. */
export async function padronCsv(db: Db, tenantId: string): Promise<{ csv: string; filas: number }> {
  const voters = await db.voter.findMany({
    where:   { tenantId },
    orderBy: { name: 'asc' },
    select: {
      cedula: true, name: true, apodo: true, phone: true, address: true, birthDate: true,
      commitmentStatus: true, esSimpatizante: true, status: true, createdAt: true, autorizacionDatosEn: true,
      leader: { select: { name: true } },
      votingTable: { select: { number: true, station: { select: { name: true } } } },
    },
  })
  const cab = ['cedula', 'nombre', 'apodo', 'celular', 'direccion', 'fecha_nacimiento', 'puesto', 'mesa', 'reporta_a',
    'compromiso', 'simpatizante', 'estado', 'registrado', 'autorizo_datos']
  const filas = voters.map((v) => [
    claro(v.cedula), v.name, v.apodo, claro(v.phone), v.address, v.birthDate?.toISOString().slice(0, 10),
    v.votingTable?.station.name, v.votingTable?.number, v.leader?.name, v.commitmentStatus, v.esSimpatizante ? 'si' : 'no',
    v.status, v.createdAt.toISOString().slice(0, 10), v.autorizacionDatosEn?.toISOString().slice(0, 10),
  ].map(csv).join(','))
  return { csv: '﻿' + [cab.join(','), ...filas].join('\n'), filas: voters.length }
}

/** Anonimiza y borra lo personal. Irreversible: quien llama ya confirmó y entregó la copia. */
export async function suprimirDatosCampana(db: Db, tenantId: string): Promise<{ electores: number }> {
  const [anonimizados] = await db.$transaction([
    // La cédula es obligatoria y única: queda una marca que no identifica a nadie.
    db.$executeRaw`UPDATE "Voter" SET name = 'Titular suprimido', apodo = NULL, phone = NULL, "telefonoHash" = NULL,
      address = NULL, lat = NULL, lng = NULL, "birthDate" = NULL, notes = NULL, "censoEstado" = NULL,
      "censoLugar" = NULL, "censoJobId" = NULL, cedula = 'suprimido:' || id, "cedulaHash" = md5('suprimido:' || id),
      "esSimpatizante" = false, "autorizacionDatosEn" = NULL, consent = false, status = 'INACTIVO'
      WHERE "tenantId" = ${tenantId} AND "isCandidate" = false`,
    db.$executeRaw`UPDATE "AutorizacionDatos" SET "revocadaEn" = now() WHERE "tenantId" = ${tenantId} AND "revocadaEn" IS NULL`,
    db.$executeRaw`UPDATE "ProspectoLider" SET nombre = 'Prospecto suprimido', phone = NULL, notas = NULL WHERE "tenantId" = ${tenantId}`,
    db.$executeRaw`UPDATE "MeetingProspecto" SET name = 'Suprimido', phone = NULL, notes = NULL
      WHERE "meetingId" IN (SELECT id FROM "Meeting" WHERE "tenantId" = ${tenantId})`,
    db.$executeRaw`DELETE FROM "PerfilSimpatizante" WHERE "tenantId" = ${tenantId}`,
    db.$executeRaw`DELETE FROM "ContactoCalle" WHERE "tenantId" = ${tenantId}`,
    db.$executeRaw`DELETE FROM "Conversacion" WHERE "tenantId" = ${tenantId}`,
    db.$executeRaw`DELETE FROM "SurveyResponse" WHERE "tenantId" = ${tenantId}`,
    db.$executeRaw`DELETE FROM "SurveyMessageLog" WHERE "tenantId" = ${tenantId}`,
    db.$executeRaw`DELETE FROM "VoterPushSubscription" WHERE "tenantId" = ${tenantId}`,
    db.$executeRaw`DELETE FROM "CompromisoAnalysis" WHERE "tenantId" = ${tenantId}`,
    db.$executeRaw`DELETE FROM "LeaderAnalysis" WHERE "tenantId" = ${tenantId}`,
    db.$executeRaw`DELETE FROM "Message" WHERE "tenantId" = ${tenantId}`,
    db.$executeRaw`DELETE FROM "Notification" WHERE "tenantId" = ${tenantId}`,
  ])
  return { electores: anonimizados }
}
