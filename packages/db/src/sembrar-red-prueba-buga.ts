#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Siembra una red de electores de PRUEBA en Buga, con forma parecida a una red
 * real de campaña, para poder ver funcionando las cuatro vistas del mapa
 * (residencia, puesto de votación, comuna, calor) y el tablero de líderes.
 *
 * Forma de la red (53 electores):
 *   El candidato de la campaña, marcado isCandidate                →  1
 *   Líder 1 ─ 9 directos, y dos de esos nueve con 11 y 8 debajo   → 29
 *   Líder 2 ─ 10 directos, y cinco de esos diez con 1 debajo      → 16
 *   7 electores sueltos, sin nadie debajo ni líder encima         →  7
 *
 * "Cercano a la realidad" quiere decir:
 *   - Nombres y cédulas colombianas plausibles (los mayores con cédulas de 6 y
 *     31 millones, que son las del Valle de antes de los 90; los jóvenes con
 *     1.1xx.xxx.xxx).
 *   - Cada elector vive DENTRO del polígono real de un barrio, y la red de un
 *     líder se concentra en su comuna con desborde a una vecina — un líder
 *     trabaja un territorio, no el municipio entero.
 *   - Vota en una mesa de un puesto de SU zona.
 *   - El compromiso decae con la distancia al líder: sus directos son voto
 *     seguro, la tercera línea apenas está contactada.
 *
 * DATOS FICTICIOS. Todos quedan marcados en `notes` con [PRUEBA] para poder
 * borrarlos: `tsx src/sembrar-red-prueba-buga.ts --limpiar`.
 *
 * Determinista: misma semilla, mismas personas. Deduplica por cedulaHash, así
 * que volver a correrlo no crea una segunda red.
 *
 * Uso desde packages/db:
 *   tsx src/sembrar-red-prueba-buga.ts
 *   tsx src/sembrar-red-prueba-buga.ts --limpiar
 */

import { createHash } from 'crypto'
import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient, type CommitmentStatus } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'
import { encrypt, decrypt } from './crypto'

neonConfig.webSocketConstructor = ws

const DIVIPOLA = '76111'
const MARCA    = '[PRUEBA]'
const LIMPIAR  = process.argv.includes('--limpiar')

type Punto = [number, number]

// ─── Aleatoriedad determinista ───────────────────────────────────────────────
// Semilla fija: la misma corrida produce las mismas personas, así el script es
// idempotente de verdad y no inventa una red distinta cada vez.
function mulberry32(semilla: number) {
  return function () {
    semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260812)
const entre  = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const deLos  = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]

// ─── Nombres ─────────────────────────────────────────────────────────────────
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

function nombrePersona(): { nombre: string; apodo: string | null } {
  const pila   = rnd() < 0.5 ? HOMBRES : MUJERES
  const nombre = `${deLos(pila)} ${deLos(APELLIDOS)} ${deLos(APELLIDOS)}`
  // Solo algunos tienen apodo — es como se les dice de verdad en el barrio.
  const apodo = rnd() < 0.35 ? nombre.split(' ')[0] : null
  return { nombre, apodo }
}

/**
 * Cédulas plausibles: los nacidos antes de los 90 en el Valle tienen 6.xxx.xxx
 * (hombres) o 31.xxx.xxx (mujeres); de ahí en adelante la serie única 1.1xx.xxx.xxx.
 */
function cedulaPlausible(mayor: boolean): string {
  if (mayor) return rnd() < 0.5 ? String(entre(6_200_000, 6_600_000)) : String(entre(31_100_000, 31_500_000))
  return String(entre(1_112_000_000, 1_118_999_999))
}

const celular = () => `3${entre(0, 2)}${entre(10, 99)}${entre(1000000, 9999999)}`.slice(0, 10)

const VIAS = ['Calle', 'Carrera', 'Diagonal', 'Transversal']
const direccion = (barrio: string) =>
  `${deLos(VIAS)} ${entre(1, 40)} # ${entre(1, 30)}-${entre(10, 99)}, ${barrio}, Guadalajara de Buga`

// ─── Geometría ───────────────────────────────────────────────────────────────
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
  // Polígono muy irregular: el centroide al menos cae en la zona correcta.
  return [
    poligono.reduce((s, p) => s + p[0], 0) / poligono.length,
    poligono.reduce((s, p) => s + p[1], 0) / poligono.length,
  ]
}

// ─── Forma de la red ─────────────────────────────────────────────────────────
interface PlanLider {
  directos:  number
  /** Cuántos cuelgan de cada uno de los primeros directos. */
  subredes:  number[]
  /** Comuna donde concentra su trabajo, y la vecina a la que desborda. */
  comunas:   [string, string]
  meta:      number
}
/** Candidato de la campaña — nombre real; cédula, teléfono y dirección ficticios. */
const CANDIDATO        = 'Splinter Adolfo Petro Libreros'
const COMUNA_CANDIDATO = 'Comuna 1' // centro histórico de Buga

const PLAN: PlanLider[] = [
  { directos: 9,  subredes: [11, 8],        comunas: ['Comuna 3', 'Comuna 4'], meta: 45 },
  { directos: 10, subredes: [1, 1, 1, 1, 1], comunas: ['Comuna 5', 'Comuna 6'], meta: 25 },
]
const SUELTOS = 7

/** El compromiso decae con la distancia al líder. */
function compromisoPorNivel(nivel: number): CommitmentStatus {
  if (nivel === 0) return 'VOTO_SEGURO'
  if (nivel === 1) return deLos<CommitmentStatus>(['VOTO_SEGURO', 'COMPROMETIDO', 'COMPROMETIDO', 'SIMPATIZANTE'])
  return deLos<CommitmentStatus>(['SIMPATIZANTE', 'CONTACTADO', 'CONTACTADO', 'SIN_CONTACTAR', 'COMPROMETIDO'])
}

async function main() {
  const superadmin = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_SUPERADMIN! }),
  })
  const tenants = await superadmin.tenant.findMany({
    where:  { isActive: true },
    select: { id: true, slug: true, connectionString: true },
  })
  await superadmin.$disconnect()

  for (const t of tenants) {
    const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: decrypt(t.connectionString) }) })
    const municipio = await db.municipality.findUnique({ where: { divipola: DIVIPOLA } })
    if (!municipio) {
      console.log(`  --  ${t.slug}: sin el municipio ${DIVIPOLA}, se omite`)
      await db.$disconnect(); continue
    }

    if (LIMPIAR) {
      const marcados = await db.voter.findMany({
        where: { tenantId: t.id, notes: { startsWith: MARCA } }, select: { id: true },
      })
      const ids = marcados.map((v) => v.id)
      // Soltar las FK propias del árbol antes de borrar, si no el self-relation lo impide.
      await db.voter.updateMany({ where: { id: { in: ids } }, data: { leaderId: null, referredById: null } })
      const { count } = await db.voter.deleteMany({ where: { id: { in: ids } } })
      console.log(`  OK  ${t.slug}: ${count} electores de prueba borrados`)
      await db.$disconnect(); continue
    }

    // Territorio: barrios con su comuna, para poder ubicar a cada quien.
    const zonas = await db.commune.findMany({
      where:  { municipalityId: municipio.id },
      select: { id: true, name: true, boundary: true, neighborhoods: { select: { name: true, boundary: true } } },
    })
    const porComuna = new Map(zonas.map((z) => [z.name, z]))
    if (zonas.length === 0) {
      console.log(`  --  ${t.slug}: sin territorio, correr db:import-territorio-buga primero`)
      await db.$disconnect(); continue
    }

    // Mesas por zona. Se prefieren los puestos YA geocodificados para que la
    // vista "por puesto de votación" (que exige lat/lng) tenga algo que pintar.
    const puestos = await db.votingStation.findMany({
      where:  { municipalityId: municipio.id },
      select: { id: true, name: true, address: true, lat: true, tables: { select: { id: true } } },
    })
    const mesasDeZona = (comuna: string) => {
      const enZona = puestos.filter((p) => (p.address ?? '').split(',')[0].trim().toLowerCase() === comuna.toLowerCase())
      const conCoord = enZona.filter((p) => p.lat !== null)
      const fuente = (conCoord.length > 0 ? conCoord : enZona.length > 0 ? enZona : puestos)
      return fuente.flatMap((p) => p.tables.map((m) => m.id))
    }

    /**
     * Crea un elector ubicado en una de las comunas dadas, o devuelve el que ya
     * existe con esa cédula.
     *
     * Dos reglas que hacen que el script sea idempotente de verdad, y que ya me
     * mordieron por saltármelas:
     *  1) TODOS los números aleatorios se consumen ANTES de mirar si el elector
     *     ya existe. Salir antes desviaría la secuencia y la siguiente persona
     *     saldría con otra cédula.
     *  2) Si ya existe se devuelve SU id, no null. Devolver null dejaba la lista
     *     de directos vacía en la segunda corrida, el bucle de subredes no se
     *     ejecutaba, y esos crear() que no ocurrían desviaban la secuencia igual.
     */
    async function crear(opts: {
      nivel: number; mayor: boolean; comunas: string[]
      leaderId?: string | null; zona?: string; meta?: number
      /** Nombre real en vez de uno generado — solo para el candidato. */
      nombreFijo?: string
      esCandidato?: boolean
    }): Promise<{ id: string; nuevo: boolean } | null> {
      const comuna = deLos(opts.comunas)
      const zona   = porComuna.get(comuna)
      if (!zona || !zona.boundary) return null

      // Vive en un barrio concreto si la comuna tiene barrios cargados; si no
      // (pasa en los corregimientos), en cualquier punto de la zona.
      const barrio = zona.neighborhoods.length > 0 ? deLos(zona.neighborhoods) : null
      const poly   = (barrio?.boundary ?? zona.boundary) as unknown as Punto[]
      const [lat, lng] = puntoDentro(poly)

      const generado = nombrePersona()
      const nombre   = opts.nombreFijo ?? generado.nombre
      const apodo    = opts.nombreFijo ? null : generado.apodo
      const cedula   = cedulaPlausible(opts.mayor)
      const telefono = celular()
      const dir      = direccion(barrio?.name ?? zona.name)
      const mesas    = mesasDeZona(comuna)
      const mesa     = mesas.length > 0 ? deLos(mesas) : null
      const estado   = compromisoPorNivel(opts.nivel)

      const hash = createHash('sha256').update(cedula).digest('hex')
      const yaEsta = await db.voter.findFirst({
        where: { tenantId: t.id, cedulaHash: hash }, select: { id: true },
      })
      if (yaEsta) return { id: yaEsta.id, nuevo: false }

      const creado = await db.voter.create({
        data: {
          tenantId:         t.id,
          name:             nombre,
          apodo,
          cedula:           encrypt(cedula),
          cedulaHash:       hash,
          phone:            encrypt(telefono),
          address:          dir,
          lat, lng,
          leaderId:         opts.leaderId ?? null,
          referredById:     opts.leaderId ?? null,
          captureDepth:     opts.nivel,
          votingTableId:    mesa,
          commitmentStatus: estado,
          isCandidate:      opts.esCandidato ?? false,
          zone:             opts.zona,
          targetVotes:      opts.meta ?? 0,
          notes:            `${MARCA} sembrado por sembrar-red-prueba-buga.ts`,
        },
        select: { id: true },
      })
      return { id: creado.id, nuevo: true }
    }

    let total = 0
    for (const plan of PLAN) {
      const lider = await crear({
        nivel: 0, mayor: true, comunas: [plan.comunas[0]],
        zona: plan.comunas[0], meta: plan.meta,
      })
      if (!lider) continue
      if (lider.nuevo) total++

      const directos: string[] = []
      for (let i = 0; i < plan.directos; i++) {
        const r = await crear({ nivel: 1, mayor: rnd() < 0.4, comunas: plan.comunas, leaderId: lider.id })
        if (r) { directos.push(r.id); if (r.nuevo) total++ }
      }

      // Las subredes cuelgan de los primeros directos, en ese orden.
      for (let i = 0; i < plan.subredes.length && i < directos.length; i++) {
        for (let j = 0; j < plan.subredes[i]; j++) {
          const r = await crear({ nivel: 2, mayor: rnd() < 0.25, comunas: plan.comunas, leaderId: directos[i] })
          if (r?.nuevo) total++
        }
      }
    }

    // Sueltos: sin líder y sin nadie debajo. Dos de ellos rurales, que es como
    // llegan los que se registran solos por el QR desde un corregimiento.
    const rurales = zonas.filter((z) => !z.name.startsWith('Comuna')).map((z) => z.name)
    for (let i = 0; i < SUELTOS; i++) {
      const comunas = i < 2 && rurales.length > 0 ? rurales : ['Comuna 1', 'Comuna 2', 'Comuna 4', 'Comuna 6']
      const r = await crear({ nivel: 0, mayor: rnd() < 0.3, comunas })
      if (r?.nuevo) total++
    }

    // El candidato va AL FINAL a propósito: crearlo antes correría la secuencia
    // del generador determinista y las cédulas de toda la red saldrían distintas,
    // así que una segunda corrida no reconocería a nadie y sembraría duplicados.
    // El schema admite a lo sumo un candidato por tenant, igual que setCandidato().
    if (!(await db.voter.findFirst({ where: { tenantId: t.id, isCandidate: true }, select: { id: true } }))) {
      const r = await crear({
        nivel: 0, mayor: true, comunas: [COMUNA_CANDIDATO],
        nombreFijo: CANDIDATO, esCandidato: true,
      })
      if (r?.nuevo) { total++; console.log(`      candidato: ${CANDIDATO}`) }
    }

    // Los sueltos no son de nadie: nadie los ha trabajado, así que quedan sin
    // contactar — compromisoPorNivel(0) los habría puesto como voto seguro,
    // que es el estado de un líder, no el de alguien que se registró solo.
    await db.voter.updateMany({
      // isCandidate excluido: comparte el perfil de un suelto (sin líder, meta 0)
      // pero obviamente no está "sin contactar".
      where: { tenantId: t.id, notes: { startsWith: MARCA }, leaderId: null, targetVotes: 0, isCandidate: false },
      data:  { commitmentStatus: 'SIN_CONTACTAR' },
    })

    const ubicados = await db.voter.count({ where: { tenantId: t.id, lat: { not: null } } })
    const conMesa  = await db.voter.count({ where: { tenantId: t.id, votingTableId: { not: null } } })
    console.log(`  OK  ${t.slug}: ${total} electores sembrados · ${ubicados} con coordenadas · ${conMesa} con mesa`)
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
