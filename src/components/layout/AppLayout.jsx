import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Wallet,
  LogOut,
  BellRing,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../services/supabaseClient'

const navClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-[#5B4BFF] text-white shadow-sm'
      : 'text-slate-700 hover:bg-[#5B4BFF]/10 hover:text-[#5B4BFF]'
  }`

export default function AppLayout() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [profileName, setProfileName] = useState('')

  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return

      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle()

      setProfileName(data?.name || '')
    }

    loadProfile()
  }, [user])

  const userName =
    profileName ||
    user?.user_metadata?.name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    user?.email ||
    'Usuário'

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
        <aside className="flex flex-col border-r border-slate-200 bg-white p-5">
          <div className="mb-8 flex items-center gap-3">
            <img
              src="/icon-lembrei.png"
              alt="Lembrei"
              className="h-11 w-11 rounded-2xl bg-white shadow-sm"
            />

            <div>
              <h1 className="text-2xl font-bold text-[#070D2D]">Lembrei</h1>
              <p className="text-sm text-slate-500">Cobrança automática</p>
            </div>
          </div>

          <nav className="space-y-2">
            <NavLink to="/app" end className={navClass}>
              <LayoutDashboard size={18} />
              Dashboard
            </NavLink>

            <NavLink to="/app/clientes" className={navClass}>
              <Users size={18} />
              Clientes
            </NavLink>

            <NavLink to="/app/cobrancas" className={navClass}>
              <Wallet size={18} />
              Cobranças
            </NavLink>

            <NavLink to="/app/automacoes" className={navClass}>
              <BellRing size={18} />
              Automações
            </NavLink>
          </nav>

          <div className="mt-auto space-y-3 pt-8">
            <div className="rounded-2xl bg-[#5B4BFF]/10 p-4">
              <p className="text-xs text-slate-500">Usuário atual</p>
              <p className="mt-1 break-words text-sm font-semibold text-[#070D2D]">
                {userName}
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </aside>

        <main className="p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}