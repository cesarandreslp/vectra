import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@vectra/auth'
import { destinoPostLogin } from '@/lib/screens'
import { DemoButton } from './_components/demo-modal'

// Sin title propio: hereda el `default` del layout raíz, que es este mismo
// texto pero sin pasar por el template (evita el sufijo "| Vectra" duplicado).

/**
 * Landing pública en `/`. Si hay sesión activa, redirige al panel
 * correspondiente al rol del usuario.
 *
 * Estructura inspirada en gocivix.com/solutions/election-management:
 * nav → hero → overview → módulos → features → stats → cumplimiento →
 * seguridad → CTA → footer. El botón "Solicitar demo" abre un modal propio.
 */
export default async function HomePage() {
  const session = await auth()
  if (session?.user) {
    redirect(destinoPostLogin(session.user.role, session.user.customPermissions))
  }

  return (
    <main className="bg-white text-slate-800">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-5 sm:px-10 h-16 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Vectra" className="h-8 w-auto" />
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-granate hover:text-granate-dark px-3 py-2">
              Iniciar sesión
            </Link>
            <DemoButton variant="solid" className="!px-4 !py-2 text-sm hidden sm:inline-block" />
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        className="text-white bg-cover bg-center"
        style={{
          backgroundImage:
            'linear-gradient(to bottom right, rgba(125,40,57,0.55), rgba(61,20,32,0.7)), url(/cabecera.png)',
        }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-10 py-20 sm:py-28 text-center">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-plata mb-4">
            Dirección estratégica para campañas electorales
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight max-w-3xl mx-auto mb-6">
            Dirección estratégica para ganar campañas con datos, no con intuición.
          </h1>
          <p className="text-base sm:text-lg text-plata-light/90 max-w-2xl mx-auto mb-9">
            Una sola plataforma para gestionar líderes, electores y testigos,
            medir la fidelidad de su red con IA y transmitir el E-14 en tiempo real.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <DemoButton variant="light" />
            <Link
              href="/login"
              className="rounded-lg px-6 py-3 font-semibold border border-white/30 hover:bg-white/10 transition text-center"
            >
              Acceder a mi campaña
            </Link>
          </div>
        </div>
      </section>

      {/* ── Overview ────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 sm:px-10 py-16 sm:py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
          Tecnología electoral moderna, segura y modular
        </h2>
        <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
          Vectra reúne todo el ciclo de una campaña en una suite de módulos que
          se activan según lo que necesite: desde la estructura territorial
          DIVIPOLA y la red de líderes, hasta la sala de situación del día de
          elecciones. Cada dato sensible viaja y reposa cifrado.
        </p>
      </section>

      {/* ── Módulos ─────────────────────────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-5 sm:px-10 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-10 sm:mb-14">
            Una suite completa para su campaña
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Modulo imagen="core"           titulo="CORE"           desc="Estructura DIVIPOLA, líderes con jerarquía, electores cifrados y QR de captación." />
            <Modulo imagen="analytics"      titulo="Analytics"      desc="KPIs, mapa de calor, proyección de votos y agente IA de fidelidad de líderes." />
            <Modulo imagen="dia-e"          titulo="Día E"          desc="Transmisión del E-14 con consenso de IA y sala de situación en vivo." />
            <Modulo imagen="formacion"      titulo="Formación"      desc="Capacitación de testigos, evaluaciones y certificados en PDF." />
            <Modulo imagen="comunicaciones" titulo="Comunicaciones" desc="SMS, WhatsApp y email segmentado con reglas de automatización por evento." />
            <Modulo imagen="finanzas"       titulo="Finanzas"       desc="Topes legales del CNE, gastos, donaciones e informes financieros." />
          </div>
        </div>
      </section>

      {/* ── Features band ───────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-5 sm:px-10 py-16 sm:py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
          <Feature
            titulo="Seguridad por diseño"
            desc="PII cifrada en reposo con AES-256-GCM, bases de datos aisladas por campaña y control de acceso por rol."
          />
          <Feature
            titulo="Automatización con IA"
            desc="Agentes que leen el E-14, miden la fidelidad de cada líder y disparan comunicaciones según cada evento."
          />
          <Feature
            titulo="Modular y escalable"
            desc="Active solo los módulos que su campaña necesita hoy y sume el resto sin migraciones ni fricción."
          />
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <section className="bg-oliva text-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-10 py-14 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          <Stat value="33"     label="Departamentos cubiertos" />
          <Stat value="1.103"  label="Municipios DIVIPOLA" />
          <Stat value="< 90 s" label="Tiempo a resultado E-14" />
          <Stat value="256-bit" label="Cifrado de datos PII" />
        </div>
      </section>

      {/* ── Cumplimiento ────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-10 py-16 sm:py-24">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="shrink-0 w-16 h-16 rounded-xl bg-granate/10 flex items-center justify-center text-granate text-2xl font-bold">
            §
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Cumplimiento de la Ley 1581 de 2012
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Tratamiento de datos personales conforme al marco legal colombiano:
              consentimiento, finalidad y seguridad de la información de electores
              y líderes, con cifrado extremo a extremo de todo campo sensible.
            </p>
          </div>
        </div>
      </section>

      {/* ── Seguridad 360 ───────────────────────────────────────────────── */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-5 sm:px-10 py-16 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Seguridad 360°</h2>
          <p className="text-slate-300 leading-relaxed">
            Cada campaña vive en su propia base de datos aislada. Las cadenas de
            conexión y todo dato PII se guardan cifrados, y cada acción verifica
            campaña, rol y módulo activo antes de ejecutarse.
          </p>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 sm:px-10 py-16 sm:py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
          ¿Listo para dirigir su campaña con datos?
        </h2>
        <p className="text-slate-600 mb-8 max-w-xl mx-auto">
          Agende una demostración y le mostramos Vectra funcionando con el
          escenario de su campaña.
        </p>
        <div className="flex justify-center">
          <DemoButton variant="solid" />
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-10 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Vectra" className="h-7 w-auto" />
          <span>© {new Date().getFullYear()} Vectra · Dirección estratégica para campañas electorales</span>
          <span className="text-slate-400">Ley 1581/2012 · AES-256-GCM</span>
        </div>
      </footer>
    </main>
  )
}

function Modulo({ titulo, desc, imagen }: { titulo: string; desc: string; imagen: string }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden hover:border-granate/40 hover:shadow-md transition">
      <Image
        src={`/modulos/${imagen}.png`}
        alt={`Módulo ${titulo}`}
        width={1376}
        height={768}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="w-full aspect-video object-cover border-b border-slate-200"
      />
      <div className="p-6">
        <div className="text-oliva text-xs font-semibold uppercase tracking-wider mb-2">Módulo</div>
        <h3 className="font-bold text-lg text-slate-900 mb-2">{titulo}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function Feature({ titulo, desc }: { titulo: string; desc: string }) {
  return (
    <div>
      <div className="w-10 h-1.5 rounded-full bg-granate mb-4" />
      <h3 className="font-bold text-lg text-slate-900 mb-2">{titulo}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl sm:text-4xl font-extrabold mb-1">{value}</div>
      <div className="text-sm text-white/80">{label}</div>
    </div>
  )
}
