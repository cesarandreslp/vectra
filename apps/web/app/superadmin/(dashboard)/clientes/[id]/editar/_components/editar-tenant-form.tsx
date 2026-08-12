'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTenant, updateTenantAdmin, type TenantEditData } from '../../../../../actions'

const input = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-granate focus:outline-none'
const label = 'block text-xs font-semibold text-slate-600 mb-1'
const btn   = 'rounded-md bg-granate px-4 py-2 text-sm font-semibold text-white transition hover:bg-granate-dark disabled:opacity-60'

function Aviso({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return (
    <p className={`text-xs font-medium ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>
  )
}

export function EditarTenantForm({ tenant }: { tenant: TenantEditData }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [name, setName]     = useState(tenant.name)
  const [slug, setSlug]     = useState(tenant.slug)
  const [domain, setDomain] = useState(tenant.domain ?? '')
  const [msgTenant, setMsgTenant] = useState<{ ok: boolean; text: string } | null>(null)

  const [email, setEmail]       = useState(tenant.adminEmail ?? '')
  const [password, setPassword] = useState('')
  const [msgAdmin, setMsgAdmin] = useState<{ ok: boolean; text: string } | null>(null)

  function guardarTenant(e: React.FormEvent) {
    e.preventDefault()
    setMsgTenant(null)
    startTransition(async () => {
      const r = await updateTenant(tenant.id, { name, slug, domain: domain || null })
      setMsgTenant(r.success ? { ok: true, text: 'Datos guardados.' } : { ok: false, text: r.error })
      if (r.success) router.refresh()
    })
  }

  function guardarAdmin(e: React.FormEvent) {
    e.preventDefault()
    setMsgAdmin(null)
    if (!tenant.adminUserId) { setMsgAdmin({ ok: false, text: 'Este tenant no tiene admin.' }); return }
    startTransition(async () => {
      const r = await updateTenantAdmin(tenant.id, { adminUserId: tenant.adminUserId!, email, newPassword: password || undefined })
      setMsgAdmin(r.success ? { ok: true, text: 'Admin actualizado.' } : { ok: false, text: r.error })
      if (r.success) { setPassword(''); router.refresh() }
    })
  }

  return (
    <div className="flex flex-col gap-8 max-w-xl">
      {/* Datos de la campaña */}
      <form onSubmit={guardarTenant} className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
        <h2 className="text-sm font-bold text-slate-900">Datos de la campaña</h2>

        <div>
          <label className={label}>Nombre</label>
          <input className={input} value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div>
          <label className={label}>Slug</label>
          <input className={input} value={slug} onChange={e => setSlug(e.target.value)} />
          <p className="mt-1 text-[11px] text-amber-600">
            Cambiar el slug invalida los enlaces de elector que usan el slug viejo (…/electores/login?c={tenant.slug}).
          </p>
        </div>

        <div>
          <label className={label}>Dominio propio (opcional)</label>
          <input className={input} placeholder="campana.com.co" value={domain} onChange={e => setDomain(e.target.value)} />
          <p className="mt-1 text-[11px] text-slate-400">
            Con dominio propio, el tenant entra por su propia URL (login por host). Vacío = entra por /login.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={btn}>Guardar datos</button>
          <Aviso msg={msgTenant} />
        </div>
      </form>

      {/* Admin del tenant */}
      <form onSubmit={guardarAdmin} className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
        <h2 className="text-sm font-bold text-slate-900">Administrador de la campaña</h2>

        <div>
          <label className={label}>Email del admin</label>
          <input className={input} type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!tenant.adminUserId} />
        </div>

        <div>
          <label className={label}>Nueva contraseña (dejar vacío para no cambiarla)</label>
          <input className={input} type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} disabled={!tenant.adminUserId} />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending || !tenant.adminUserId} className={btn}>Guardar admin</button>
          <Aviso msg={msgAdmin} />
        </div>
      </form>
    </div>
  )
}
