import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEstadoCierre } from '../../../../actions-cierre'
import { CerrarCampana } from './_components/cerrar-campana'

export const metadata = { title: 'Cerrar campaña — Superadmin' }

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric' }) : '—')

export default async function CierrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const e = await getEstadoCierre(id)
  if (!e) notFound()

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <Link href="/superadmin/clientes" className="text-slate-500 text-xs hover:text-granate transition">&larr; Volver a clientes</Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Cerrar campaña — {e.nombre}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ley 1581: terminada la finalidad (la campaña), los datos personales se suprimen. Antes se le entrega a la
          campaña la copia de su padrón, porque ella es la responsable de esos datos.
        </p>
      </div>

      {e.datosSuprimidosEn ? (
        <div className="bg-slate-100 rounded-lg p-4 text-sm text-slate-700">
          Datos personales suprimidos el {fecha(e.datosSuprimidosEn)}. La campaña y sus cuentas están desactivadas.
          Quedan las finanzas y los resultados electorales; borrar el proyecto de base de datos entero es un paso manual
          cuando venza la obligación legal de conservarlos.
        </div>
      ) : (
        <>
          <section className="bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-700 space-y-1">
            <div>Elección: <b>{fecha(e.fechaEleccion)}</b> · Electores en el padrón: <b>{e.electores}</b> · {e.activa ? 'Activa' : 'Desactivada'}</div>
            <div>
              Se suprime: nombre, cédula, celular, dirección y fecha de nacimiento de todos los electores (menos el candidato),
              perfiles, contactos, conversaciones, respuestas de encuestas, mensajes y notificaciones.
            </div>
            <div>Se conserva: finanzas (Ley 1475), resultados electorales y la prueba de las autorizaciones y solicitudes de titulares.</div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="text-sm font-semibold text-slate-800">1. Copia del padrón para la campaña</div>
            <a href={`/superadmin/clientes/${e.id}/cierre/copia`} className="inline-block bg-slate-800 text-white text-sm font-semibold rounded-md px-4 py-2">
              Descargar copia (CSV)
            </a>
            <div className="text-xs text-slate-500">
              {e.copiaPadronEn ? `Última copia generada el ${fecha(e.copiaPadronEn)}.` : 'Todavía no se ha generado.'} Entrégala por un canal
              seguro y bórrala de tu equipo después: contiene cédulas y celulares en claro.
            </div>
          </section>

          <CerrarCampana tenantId={e.id} slug={e.slug} hayCopia={Boolean(e.copiaPadronEn)} />
        </>
      )}
    </div>
  )
}
