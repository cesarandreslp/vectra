#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Siembra testigos de PRUEBA para ver la cobertura de mesas a escala real.
 *
 * Por defecto crea 320 con puesto y mesa asignada y 9 sin asignar, así queda
 * una franja de mesas descubiertas y una banca de testigos disponibles — que es
 * el estado real de una campaña a mitad del armado.
 *
 * Cada testigo queda como en el alta de /core/usuarios:
 *   - Voter con cédula cifrada, colgado del candidato, ubicado dentro del
 *     polígono real de un barrio, y votando en la mesa que va a vigilar.
 *   - User con rol TESTIGO vinculado a ese Voter.
 *   - WitnessAssignment sobre la mesa.
 *
 * SIN CONTRASEÑA UTILIZABLE: cada cuenta lleva un hash aleatorio que no
 * corresponde a ninguna clave. Son para ver el sistema lleno, no para entrar.
 * Para entrar como uno, ponerle contraseña con db:reset-password.
 *
 * Las mesas cubiertas se eligen al azar (semilla fija) en vez de las primeras,
 * para que lo que falte quede repartido entre puestos y la lista de cobertura
 * se parezca a la realidad.
 *
 * DATOS FICTICIOS. Se borran con --limpiar (se reconocen por el correo
 * @testigo.prueba y por [PRUEBA-TESTIGO] en las notas del elector).
 *
 * Uso desde packages/db:
 *   tsx src/sembrar-testigos-prueba.ts
 *   tsx src/sembrar-testigos-prueba.ts --limpiar
 *   tsx src/sembrar-testigos-prueba.ts --asignados 100 --libres 5
 */

import { createHash, randomBytes } from 'crypto'
import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import bcrypt from 'bcryptjs'
import ws from 'ws'
import { encrypt, decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const DOMINIO = 'testigo.prueba'
const MARCA   = '[PRUEBA-TESTIGO]'
const LIMPIAR = process.argv.includes('--limpiar')

function argNumero(nombre: string, pordefecto: number): number {
  const i = process.argv.indexOf(`--${nombre}`)
  if (i === -1) return pordefecto
  const n = Number(process.argv[i + 1])
  return Number.isFinite(n) && n >= 0 ? n : pordefecto
}
const ASIGNADOS = argNumero('asignados', 320)
const LIBRES    = argNumero('libres', 9)

// ─── Aleatoriedad determinista ───────────────────────────────────────────────
function mulberry32(semilla: number) {
  return function () {
    semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd   = mulberry32(20260814)
const entre = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const deLos = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]

/** Baraja determinista (Fisher-Yates con la misma semilla). */
function barajar<T>(xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Personas ────────────────────────────────────────────────────────────────
const HOMBRES = ['Jhon Jairo', 'Luis Fernando', 'Carlos Andrés', 'Wilson', 'Héctor Fabio', 'Diego Armando',
  'Óscar Iván', 'Jairo', 'Édinson', 'Nelson', 'Fabián', 'Alexánder', 'Yeison', 'Duván', 'Hernán Darío',
  'Álvaro', 'Gustavo Adolfo', 'Ferney', 'Arley', 'Jorge Eliécer', 'Milton', 'Robinson', 'Deiby']
const MUJERES = ['María Eugenia', 'Luz Marina', 'Gloria Amparo', 'Yolanda', 'Diana Carolina', 'Leidy Johana',
  'Martha Lucía', 'Nury', 'Claudia Patricia', 'Rosa Elvira', 'Ana Milena', 'Yesenia', 'Dora Ligia',
  'Beatriz Elena', 'Sandra Milena', 'Alba Lucía', 'Yamileth', 'Erika Tatiana', 'Consuelo', 'Mariela']
const APELLIDOS = ['Valencia', 'Ospina', 'Grajales', 'Hurtado', 'Mosquera', 'Cifuentes', 'Betancourt',
  'Quintero', 'Zapata', 'Caicedo', 'Arboleda', 'Marmolejo', 'Sinisterra', 'Bermúdez', 'Salazar',
  'Riascos', 'Lozano', 'Peña', 'Angulo', 'Cardona', 'Toro', 'Escobar', 'Gutiérrez', 'Ramírez',
  'Bonilla', 'Micolta', 'Vallecilla', 'Ocampo', 'Gil', 'Loaiza']

const nombrePersona = () => `${deLos(rnd() < 0.5 ? HOMBRES : MUJERES)} ${deLos(APELLIDOS)} ${deLos(APELLIDOS)}`

/** Cédulas del Valle: mayores con 6.x/31.x millones, jóvenes con la serie única. */
const cedulaPlausible = () =>
  rnd() < 0.45
    ? String(rnd() < 0.5 ? entre(6_200_000, 6_600_000) : entre(31_100_000, 31_500_000))
    : String(entre(1_112_000_000, 1_118_999_999))

const celular = () => `3${entre(0, 2)}${entre(10, 99)}${entre(1000000, 9999999)}`.slice(0, 10)

const VIAS = ['Calle', 'Carrera', 'Diagonal', 'Transversal']
const direccion = (barrio: string) =>
  `${deLos(VIAS)} ${entre(1, 40)} # ${entre(1, 30)}-${entre(10, 99)}, ${barrio}, Guadalajara de Buga`

// ─── Geometría ───────────────────────────────────────────────────────────────
type Punto = [number, number]

function puntoEnPoligono([px, py]: Punto, poligono: Punto[]): boolean {
  let dentro = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i]
    const [xj, yj] = poligono[j]
    const cruza = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (cruza) dentro = !dentro
  }
  return dentro
}

/** Punto al azar dentro del polígono, por rechazo sobre su bbox. */
function puntoDentro(poligono: Punto[]): Punto {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
  for (const [lat, lng] of poligono) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  for (let i = 0; i < 300; i++) {
    const p: Punto = [minLat + rnd() * (maxLat - minLat), minLng + rnd() * (maxLng - minLng)]
    if (puntoEnPoligono(p, poligono)) return p
  }
  return [
    poligono.reduce((s, p) => s + p[0], 0) / poligono.length,
    poligono.reduce((s, p) => s + p[1], 0) / poligono.length,
  ]
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const conn = process.env.DATABASE_URL_SUPERADMIN
  if (!conn) throw new Error('Falta DATABASE_URL_SUPERADMIN en .env')

  const superadmin = new PrismaClient({ adapter: new PrismaNeon({ connectionString: conn }) })
  const tenant = await superadmin.tenant.findFirst({
    where:  { isActive: true },
    select: { id: true, slug: true, connectionString: true },
  })
  if (!tenant) throw new Error('No hay tenants activos')

  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: decrypt(tenant.connectionString) }) })
  console.log(`\nTenant: ${tenant.slug}\n`)

  if (LIMPIAR) {
    await limpiar(superadmin, db, tenant.id)
    await db.$disconnect(); await superadmin.$disconnect()
    return
  }

  // Idempotencia: si ya hay sembrados, no se duplica.
  const yaHay = await superadmin.user.count({
    where: { tenantId: tenant.id, email: { endsWith: `@${DOMINIO}` } },
  })
  if (yaHay > 0) {
    console.log(`Ya hay ${yaHay} testigos de prueba. Corre con --limpiar antes de volver a sembrar.`)
    await db.$disconnect(); await superadmin.$disconnect()
    return
  }

  const [candidato, barrios, mesas, asignadasYa] = await Promise.all([
    db.voter.findFirst({ where: { tenantId: tenant.id, isCandidate: true }, select: { id: true, name: true } }),
    db.neighborhood.findMany({ select: { id: true, name: true, boundary: true } }),
    db.votingTable.findMany({
      select:  { id: true, number: true, station: { select: { name: true } } },
      orderBy: [{ stationId: 'asc' }, { number: 'asc' }],
    }),
    db.witnessAssignment.findMany({ where: { tenantId: tenant.id }, select: { votingTableId: true } }),
  ])

  if (!candidato) throw new Error('No hay candidato marcado (isCandidate) — los testigos cuelgan de él')
  const conPoligono = barrios.flatMap((b) => {
    const pol = b.boundary as Punto[] | null
    return pol?.length ? [{ id: b.id, name: b.name, pol }] : []
  })
  if (conPoligono.length === 0) throw new Error('No hay barrios con polígono para ubicar a los testigos')

  const ocupadas = new Set(asignadasYa.map((a) => a.votingTableId))
  const libres   = mesas.filter((m) => !ocupadas.has(m.id))

  if (libres.length < ASIGNADOS) {
    console.log(`! Solo hay ${libres.length} mesas libres y se pidieron ${ASIGNADOS}. Se asignan ${libres.length}.`)
  }
  // Al azar y no las primeras: así lo que quede descubierto se reparte entre
  // puestos, que es como se ve una campaña a medio armar.
  const aCubrir = barajar(libres).slice(0, Math.min(ASIGNADOS, libres.length))

  console.log(`Candidato: ${candidato.name}`)
  console.log(`Mesas: ${mesas.length} · ya cubiertas: ${ocupadas.size} · a cubrir ahora: ${aCubrir.length}`)
  console.log(`Testigos sin asignar: ${LIBRES}\n`)

  // Un solo hash para todos: bcrypt cuesta ~100ms y 329 serían medio minuto de
  // espera para una contraseña que igual nadie va a usar. Sale de bytes
  // aleatorios que no se imprimen: la clave no la conoce nadie, ni yo.
  const hashInservible = await bcrypt.hash(randomBytes(32).toString('hex'), 12)

  const usados = new Set<string>()
  let creados = 0, saltados = 0

  for (let i = 0; i < aCubrir.length + LIBRES; i++) {
    const mesa   = i < aCubrir.length ? aCubrir[i] : null
    const barrio = deLos(conPoligono)
    const [lat, lng] = puntoDentro(barrio.pol)
    const nombre = nombrePersona()

    // Cédula única dentro de la corrida y contra lo que ya está en la BD.
    let cedula = cedulaPlausible()
    let intento = 0
    while (usados.has(cedula) && intento++ < 50) cedula = cedulaPlausible()
    if (usados.has(cedula)) { saltados++; continue }
    usados.add(cedula)

    // Mismo cálculo que apps/web/lib/cedula-hash.ts — si difiere, la app no
    // reconoce estas cédulas como duplicadas y se pueden volver a cargar.
    const cedulaHash = createHash('sha256').update(cedula.trim()).digest('hex')
    if (await db.voter.findFirst({ where: { tenantId: tenant.id, cedulaHash }, select: { id: true } })) {
      saltados++; continue
    }

    const elector = await db.voter.create({
      data: {
        tenantId:      tenant.id,
        cedula:        encrypt(cedula),
        cedulaHash,
        name:          nombre,
        phone:         encrypt(celular()),
        address:       direccion(barrio.name),
        lat, lng,
        // El barrio no se digita, pero acá lo SABEMOS: es el polígono en que se
        // generó el punto. Guardarlo es lo que hace que el filtro por barrio los vea.
        neighborhoodId: barrio.id,
        leaderId:      candidato.id,
        // Vota en la mesa que va a vigilar — el caso ideal del criterio 1.
        votingTableId: mesa?.id,
        commitmentStatus: 'VOTO_SEGURO',
        notes:         MARCA,
      },
    })

    const usuario = await superadmin.user.create({
      data: {
        tenantId:     tenant.id,
        name:         nombre,
        email:        `testigo${String(i + 1).padStart(3, '0')}@${DOMINIO}`,
        passwordHash: hashInservible,
        role:         'TESTIGO',
        voterId:      elector.id,
        isActive:     true,
      },
      select: { id: true },
    })

    if (mesa) {
      await db.witnessAssignment.create({
        data: { tenantId: tenant.id, userId: usuario.id, votingTableId: mesa.id, isPrimary: true },
      })
    }

    creados++
    if (creados % 50 === 0) console.log(`  ${creados}…`)
  }

  const cubiertas = await db.witnessAssignment.count({ where: { tenantId: tenant.id } })
  console.log(`\n✓ Testigos creados: ${creados}${saltados ? ` (saltados por cédula repetida: ${saltados})` : ''}`)
  console.log(`  Mesas con testigo: ${cubiertas} de ${mesas.length} — quedan ${mesas.length - cubiertas} sin cubrir`)
  console.log(`  Sin asignar: ${LIBRES}`)
  console.log(`\n  Las cuentas NO tienen contraseña utilizable. Para entrar como una, usa db:reset-password.\n`)

  await db.$disconnect()
  await superadmin.$disconnect()
}

async function limpiar(superadmin: PrismaClient, db: PrismaClient, tenantId: string) {
  const usuarios = await superadmin.user.findMany({
    where:  { tenantId, email: { endsWith: `@${DOMINIO}` } },
    select: { id: true, voterId: true },
  })
  if (usuarios.length === 0) { console.log('No hay testigos de prueba que borrar.'); return }

  const ids      = usuarios.map((u) => u.id)
  const voterIds = usuarios.flatMap((u) => (u.voterId ? [u.voterId] : []))

  const asign = await db.witnessAssignment.deleteMany({ where: { tenantId, userId: { in: ids } } })
  // Las transmisiones cuelgan del testigo: si quedaran, apuntarían a un usuario
  // borrado y la sala mostraría filas sin dueño.
  const trans = await db.e14Transmission.deleteMany({ where: { tenantId, witnessUserId: { in: ids } } })
  const users = await superadmin.user.deleteMany({ where: { id: { in: ids } } })
  const votos = await db.voter.deleteMany({ where: { tenantId, id: { in: voterIds }, notes: MARCA } })

  console.log(`Borrados: ${users.count} usuarios, ${votos.count} electores, ${asign.count} asignaciones, ${trans.count} transmisiones.`)
}

main().catch((err) => {
  console.error('\nError:', err instanceof Error ? err.message : err)
  process.exit(1)
})
