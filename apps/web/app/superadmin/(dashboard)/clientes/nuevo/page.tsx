'use client'

/**
 * Formulario de creación de nuevo tenant.
 * Es un componente cliente para manejar el estado del slug en tiempo real.
 * Llama a createTenant() al hacer submit.
 */

import { useState, useTransition } from 'react'
import { createTenant, type ModuleKey } from '../../../actions'
import { SlugInput } from './_components/slug-input'

// Módulos disponibles para activar en una nueva campaña
const MODULOS_DISPONIBLES: { key: ModuleKey; label: string; descripcion: string }[] = [
  { key: 'CORE',           label: 'CORE',           descripcion: 'Obligatorio — territorios, líderes, electores' },
  { key: 'ANALYTICS',      label: 'Analytics',      descripcion: 'KPIs, mapa de calor, proyección de votos' },
  { key: 'FORMACION',      label: 'Formación',      descripcion: 'Capacitación de testigos y evaluaciones' },
  { key: 'DIA_E',          label: 'Día E',          descripcion: 'Transmisión E-14 y sala de situación' },
  { key: 'COMUNICACIONES', label: 'Comunicaciones', descripcion: 'SMS / WhatsApp / email segmentado' },
  { key: 'FINANZAS',       label: 'Finanzas',       descripcion: 'Control de gastos y límites legales' },
]

export default function NuevoClientePage() {
  // Estado del formulario
  const [nombre,     setNombre]     = useState('')
  const [slug,       setSlug]       = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [adminName,  setAdminName]  = useState('')
  const [adminCedula, setAdminCedula] = useState('')
  const [modulos,    setModulos]    = useState<ModuleKey[]>(['CORE'])
  const [resultado,  setResultado]  = useState<string | null>(null)
  const [esError,    setEsError]    = useState(false)

  const [isPending, startTransition] = useTransition()

  function toggleModulo(key: ModuleKey) {
    if (key === 'CORE') return // CORE siempre activo, no se puede desmarcar
    setModulos(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResultado(null)

    startTransition(async () => {
      const res = await createTenant({
        name:          nombre,
        slug,
        adminEmail:    email,
        adminPassword: password,
        adminName,
        adminCedula,
        modules:       modulos,
      })

      if (res.success) {
        setResultado(`Tenant creado correctamente. ID: ${res.tenantId}`)
        setEsError(false)
        // Limpiar formulario
        setNombre(''); setSlug(''); setEmail(''); setPassword('')
        setAdminName(''); setAdminCedula('')
        setModulos(['CORE'])
      } else {
        setResultado(res.error)
        setEsError(true)
      }
    })
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Nuevo cliente</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cada campaña recibe su propia base de datos aislada y los módulos que active aquí.
        </p>
      </header>

      {/* En escritorio: datos a la izquierda, módulos a la derecha. En móvil se
          apila. Antes era una columna estrecha con media pantalla desperdiciada. */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col gap-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Datos de la campaña
          </h2>

          <Campo label="Nombre de la campaña *">
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
              placeholder="Campaña Gómez 2026"
              className={CLASE_INPUT}
            />
          </Campo>

          {/* Slug — componente cliente con validación en tiempo real */}
          <SlugInput value={slug} onChange={setSlug} />

          {/* El admin también es elector de la campaña: con estos dos datos se
              le crea su Voter al provisionar. Si su cédula ya está en el padrón,
              se vincula al elector existente en vez de duplicarlo. */}
          <Campo label="Nombre del administrador *">
            <input
              type="text"
              value={adminName}
              onChange={e => setAdminName(e.target.value)}
              required
              placeholder="Nombre y apellidos"
              className={CLASE_INPUT}
            />
          </Campo>

          <Campo label="Cédula del administrador *">
            <input
              type="text"
              inputMode="numeric"
              value={adminCedula}
              onChange={e => setAdminCedula(e.target.value.replace(/\D/g, ''))}
              required
              pattern="\d{5,15}"
              placeholder="Solo números — queda como su elector en la campaña"
              className={CLASE_INPUT}
            />
          </Campo>

          <Campo label="Email del administrador *">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="admin@campana.com"
              className={CLASE_INPUT}
            />
          </Campo>

          <Campo label="Contraseña del administrador *">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className={CLASE_INPUT}
            />
          </Campo>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Módulos activos
          </h2>
          <div className="flex flex-col gap-2">
            {MODULOS_DISPONIBLES.map(({ key, label, descripcion }) => {
              const activo = modulos.includes(key)
              const bloqueado = key === 'CORE'
              return (
                <label
                  key={key}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition ${
                    bloqueado
                      ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                      : activo
                        ? 'border-granate/40 bg-granate/5 cursor-pointer'
                        : 'border-slate-200 hover:border-slate-300 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={() => toggleModulo(key)}
                    disabled={bloqueado}
                    className="mt-0.5 w-4 h-4 accent-granate"
                  />
                  <div className="leading-snug">
                    <span className="font-semibold text-sm text-slate-900">{label}</span>
                    <span className="text-slate-500 text-xs"> — {descripcion}</span>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Pie del formulario: ocupa las dos columnas */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {resultado && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                esError
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {resultado}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="self-start bg-granate text-white px-5 py-2.5 rounded-md text-sm font-semibold hover:bg-granate-dark disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isPending ? 'Creando...' : 'Crear cliente'}
          </button>
        </div>

      </form>
    </div>
  )
}

// Helper de layout para campos del formulario
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// Sin `export`: Next.js sólo admite exports conocidos en un archivo de página
const CLASE_INPUT =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 outline-none transition ' +
  'focus:border-granate focus:ring-2 focus:ring-granate/20'
