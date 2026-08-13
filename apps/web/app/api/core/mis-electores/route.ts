import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@vectra/auth'
import { getTenantConnection }        from '@/lib/tenant'
import { getTenantDb, decrypt }      from '@vectra/db'
import { idsSubarbol, profundidadSubarbol } from '@/app/(tenant)/core/actions'
import { calcularIndiceCompromiso }  from '@/lib/compromiso'

/**
 * GET /api/core/mis-electores
 *
 * Retorna los electores asignados al líder autenticado.
 * Soporta ?since=<timestamp ISO> para sincronización incremental (solo cambios nuevos).
 * Diseñado para ser cacheado por el service worker en modo offline.
 *
 * El campo `phone` se descifra server-side antes de enviarse para que la PWA
 * pueda usarlo en `tel:` (click-to-call). Queda en IndexedDB del dispositivo
 * del testigo — costo natural de una PWA offline.
 *
 * Campos retornados (sin cédula):
 *   id, name, phone (texto plano), commitmentStatus, lastContact, votingTableId, notes
 */
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Solo roles con acceso al módulo CORE
  const rolesPermitidos = ['ADMIN_CAMPANA', 'COORDINADOR', 'LIDER', 'TESTIGO', 'ELECTOR']
  if (!rolesPermitidos.includes(session.user.role)) {
    return NextResponse.json({ error: 'Sin autorización' }, { status: 403 })
  }

  // Verificar que el módulo CORE está activo
  if (!session.user.activeModules.includes('CORE')) {
    return NextResponse.json({ error: 'Módulo CORE no activo' }, { status: 403 })
  }

  try {
    const connectionString = await getTenantConnection(session.user.tenantId)
    const db               = getTenantDb(connectionString)

    // Parámetro opcional para sincronización incremental
    const sinceParam = request.nextUrl.searchParams.get('since')
    const desde      = sinceParam ? new Date(sinceParam) : undefined

    // LIDER/ELECTOR solo ven su propio sub-árbol; si no está vinculado a un Voter, no ve nada.
    const esAcotado = session.user.role === 'LIDER' || session.user.role === 'ELECTOR'
    const idsPermitidos = esAcotado
      ? (session.user.voterId ? await idsSubarbol(session.user.voterId, session.user.tenantId, db as any) : new Set<string>())
      : null
    // Profundidad respecto a quién inició sesión (0 = él mismo, 1 = directos, 2+ = "de mi
    // gente") — para que la PWA distinga quién le reporta a él de quién viene de más abajo.
    const profundidades = esAcotado && session.user.voterId
      ? await profundidadSubarbol(session.user.voterId, session.user.tenantId, db as any)
      : null

    // Estado de la encuesta activa por elector — para que un líder vea de un
    // vistazo quién de su gente ya la diligenció. null = no hay encuesta activa
    // (módulo apagado, sin campaña activa, o campaña sin preguntas).
    let preguntaIdsActivas: string[] = []
    if (session.user.activeModules.includes('ENCUESTAS')) {
      const campania = await db.surveyCampaign.findFirst({
        where:   { tenantId: session.user.tenantId, isActive: true, isSurveyEnabled: true },
        include: { cargos: { include: { preguntas: { select: { id: true } } } } },
      })
      preguntaIdsActivas = campania?.cargos.flatMap((c) => c.preguntas.map((p) => p.id)) ?? []
    }

    const electores = await db.voter.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(idsPermitidos && { id: { in: [...idsPermitidos] } }),
        // Si hay parámetro since, retornar solo registros modificados después
        ...(desde && {
          OR: [
            { lastContact: { gt: desde } },
            { createdAt:   { gt: desde } },
          ],
        }),
      },
      select: {
        id:               true,
        name:             true,
        apodo:            true,   // como le dicen — para el mensaje de invitación
        phone:            true,   // Cifrado en DB — se descifra abajo para click-to-call
        commitmentStatus: true,
        lastContact:      true,
        votingTableId:    true,
        notes:            true,
        lat:              true,   // para el mapa de calor de la PWA
        lng:              true,
        // cedula: NUNCA
      },
      orderBy: [
        { lastContact: 'asc' },   // Los más viejos primero (necesitan atención)
        { name:        'asc' },
      ],
    })

    // QR propio de cada elector (leaderId = su id) — referencia suelta, no hay
    // relación en el schema. Todo elector tiene el suyo desde que se crea.
    const qrsPropios = await db.qrRegistration.findMany({
      where:   { tenantId: session.user.tenantId, leaderId: { in: electores.map((e) => e.id) }, isActive: true },
      orderBy: { createdAt: 'asc' },
      select:  { leaderId: true, token: true },
    })
    const tokenPropioPorElector = new Map<string, string>()
    for (const qr of qrsPropios) {
      if (!tokenPropioPorElector.has(qr.leaderId)) tokenPropioPorElector.set(qr.leaderId, qr.token)
    }

    const respondidasPorVoter = new Map<string, number>()
    if (preguntaIdsActivas.length > 0) {
      const respuestas = await db.surveyResponse.groupBy({
        by:    ['voterId'],
        where: { voterId: { in: electores.map((e) => e.id) }, surveyPreguntaId: { in: preguntaIdsActivas } },
        _count: { id: true },
      })
      for (const r of respuestas) respondidasPorVoter.set(r.voterId, r._count.id)
    }

    // Señales del índice de compromiso (encuestas + reuniones + masificación) —
    // ver lib/compromiso.ts para el cálculo.
    const electorIds = electores.map((e) => e.id)
    const [asistenciasPorVoter, capturadosPorLider] = await Promise.all([
      db.meetingAttendance.groupBy({
        by: ['voterId'],
        where: { voterId: { in: electorIds } },
        _count: { id: true },
      }),
      db.voter.groupBy({
        by: ['leaderId'],
        where: { tenantId: session.user.tenantId, leaderId: { in: electorIds } },
        _count: { id: true },
      }),
    ])
    const reunionesPorVoter = new Map(asistenciasPorVoter.map((a) => [a.voterId, a._count.id]))
    const capturadosMap     = new Map(capturadosPorLider.map((c) => [c.leaderId as string, c._count.id]))

    const electoresDescifrados = electores.map((e) => {
      let phonePlain: string | null = null
      if (e.phone) {
        try {
          phonePlain = decrypt(e.phone)
        } catch {
          // Si falla el descifrado (registro corrupto o llave rotada), omitir el campo
          console.error(`[GET /api/core/mis-electores] phone no descifrable para voter ${e.id}`)
        }
      }
      const encuestaEstado = preguntaIdsActivas.length === 0
        ? null
        : (respondidasPorVoter.get(e.id) ?? 0) >= preguntaIdsActivas.length ? 'completa' : 'pendiente'

      const compromiso = calcularIndiceCompromiso({
        encuestasRespondidas: respondidasPorVoter.get(e.id) ?? 0,
        encuestasTotal:       preguntaIdsActivas.length,
        reunionesAsistidas:   reunionesPorVoter.get(e.id) ?? 0,
        personasCaptadas:     capturadosMap.get(e.id) ?? 0,
      })

      return {
        ...e,
        phone:     phonePlain,
        myQrToken: tokenPropioPorElector.get(e.id) ?? null,
        depth:     profundidades?.get(e.id) ?? null,
        encuestaEstado,
        compromiso,
      }
    })
    // Con vista acotada, no tiene sentido que aparezca él mismo en "mis electores".
    const listaFinal = esAcotado
      ? electoresDescifrados.filter((e) => e.depth !== 0)
      : electoresDescifrados

    // El QR propio de QUIEN inició sesión, para que pueda invitar desde su
    // pantalla. No sale de la lista de arriba: en vista acotada él no aparece
    // entre "sus" electores.
    const yo = session.user.voterId
      ? await db.voter.findFirst({
          where:  { id: session.user.voterId, tenantId: session.user.tenantId },
          select: { name: true, apodo: true },
        })
      : null
    const miQr = session.user.voterId
      ? await db.qrRegistration.findFirst({
          where:   { tenantId: session.user.tenantId, leaderId: session.user.voterId, isActive: true },
          orderBy: { createdAt: 'asc' },
          select:  { token: true },
        })
      : null

    return NextResponse.json(
      // tenantSlug: necesario para construir el link de referido (?c=slug), que
      // la página de registro exige para resolver el tenant.
      {
        electores: listaFinal,
        tenantSlug: session.user.tenantSlug,
        yo: yo ? { nombre: yo.apodo?.trim() || yo.name, qrToken: miQr?.token ?? null } : null,
        syncAt: new Date().toISOString(),
      },
      {
        headers: {
          // Permitir que el service worker cachee esta respuesta
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (err) {
    console.error('[GET /api/core/mis-electores]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
