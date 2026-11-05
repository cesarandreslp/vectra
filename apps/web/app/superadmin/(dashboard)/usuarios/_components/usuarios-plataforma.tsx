'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cambiarEstadoUsuarioPlataforma, crearUsuarioPlataforma, type UsuarioPlataforma } from '../../../actions-usuarios'

const ROL = { SUPERADMIN: 'Superadmin', OPERADOR: 'Operador' } as const
const input = 'block w-full border border-slate-300 rounded-md px-3 py-2 text-sm'

export function UsuariosPlataforma({ usuarios }: { usuarios: UsuarioPlataforma[] }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OPERADOR' as 'SUPERADMIN' | 'OPERADOR' })

  const correr = (f: () => Promise<{ success: true } | { success: false; error: string }>, ok: string, alTerminar?: () => void) =>
    iniciar(async () => {
      const r = await f()
      setMensaje(r.success ? { ok: true, texto: ok } : { ok: false, texto: r.error })
      if (r.success) { alTerminar?.(); router.refresh() }
    })

  return (
    <>
      <table className="w-full text-sm bg-white border border-slate-200 rounded-lg overflow-hidden">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr><th className="px-3 py-2">Cuenta</th><th className="px-3 py-2">Rol</th><th className="px-3 py-2">Doble factor</th><th className="px-3 py-2">Estado</th></tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className="border-t border-slate-100">
              <td className="px-3 py-2">{u.name && <div className="font-medium">{u.name}</div>}<div className="text-slate-500">{u.email}{u.esYo && ' (tú)'}</div></td>
              <td className="px-3 py-2">{ROL[u.role]}</td>
              <td className="px-3 py-2">{u.dobleFactor ? <span className="text-green-700">activo</span> : <span className="text-red-700">apagado</span>}</td>
              <td className="px-3 py-2">
                {u.esYo ? <span className="text-green-700">activa</span> : (
                  <button type="button" disabled={pendiente}
                    onClick={() => correr(() => cambiarEstadoUsuarioPlataforma(u.id, !u.isActive), u.isActive ? 'Cuenta desactivada.' : 'Cuenta activada.')}
                    className={`text-xs font-semibold rounded-md border px-2 py-1 ${u.isActive ? 'border-red-300 text-red-700' : 'border-green-300 text-green-700'}`}>
                    {u.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        onSubmit={(e) => { e.preventDefault(); correr(() => crearUsuarioPlataforma(form), 'Cuenta creada.', () => setForm({ name: '', email: '', password: '', role: 'OPERADOR' })) }}
        className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-3"
      >
        <div className="text-sm font-semibold">Nueva cuenta</div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))' }}>
          <label className="text-xs text-slate-600">Nombre<input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="text-xs text-slate-600">Correo<input className={input} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="text-xs text-slate-600">Contraseña (mínimo 12)<input className={input} type="password" autoComplete="new-password" required minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <label className="text-xs text-slate-600">Rol
            <select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'SUPERADMIN' | 'OPERADOR' })}>
              <option value="OPERADOR">Operador</option>
              <option value="SUPERADMIN">Superadmin</option>
            </select>
          </label>
        </div>
        <button type="submit" disabled={pendiente} className="self-start bg-slate-900 text-white text-sm font-semibold rounded-md px-4 py-2 disabled:opacity-50">
          {pendiente ? 'Guardando…' : 'Crear cuenta'}
        </button>
      </form>
      {mensaje && <p className={`text-sm ${mensaje.ok ? 'text-green-700' : 'text-red-700'}`}>{mensaje.texto}</p>}
    </>
  )
}
