import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Wallet,
  LogOut,
  BellRing,
  PlugZap,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../services/supabaseClient'

const navItems = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/clientes', label: 'Clientes', icon: Users },
  { to: '/app/cobrancas', label: 'Cobranças', icon: Wallet },
  { to: '/app/automacoes', label: 'Automações', icon: BellRing },
  { to: '/app/configuracoes', label: 'Configurações', icon: PlugZap }

]

const navClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
    isActive
      ? 'bg-[#5B4BFF] text-white shadow-sm'
      : 'text-slate-700 hover:bg-[#5B4BFF]/10 hover:text-[#5B4BFF]'
  }`

export default function AppLayout() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [profileName, setProfileName] = useState('')
  const [openUserMenu, setOpenUserMenu] = useState(false)
  const [openMobileMenu, setOpenMobileMenu] = useState(false)

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

  const userInitial = userName?.charAt(0)?.toUpperCase() || 'U'

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  function closeMobileMenu() {
    setOpenMobileMenu(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* MENU MOBILE */}
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <button
          type="button"
          onClick={() => setOpenMobileMenu((current) => !current)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
        >
          <img
            src="/icon-lembrei.png"
            alt="Lembrei"
            className="h-8 w-8 rounded-xl"
          />
        </button>

        {openMobileMenu ? (
          <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
            <div className="mb-3 flex items-center gap-3 border-b border-slate-100 pb-3">
              <img
                src="/icon-lembrei.png"
                alt="Lembrei"
                className="h-9 w-9 rounded-xl"
              />
              <div>
                <p className="font-bold text-[#070D2D]">Lembrei</p>
                <p className="text-xs text-slate-500">Cobrança automática</p>
              </div>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={closeMobileMenu}
                    className={navClass}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>
          </div>
        ) : null}
      </div>

      {/* USUÁRIO MOBILE */}
      <div className="fixed right-4 top-4 z-50 md:hidden">
        <button
          type="button"
          onClick={() => setOpenUserMenu((current) => !current)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5B4BFF] text-sm font-bold text-white shadow-sm"
        >
          {userInitial}
        </button>

        {openUserMenu ? (
          <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200">
            <p className="text-xs text-slate-500">Usuário atual</p>
            <p className="mt-1 break-words text-sm font-semibold text-[#070D2D]">
              {userName}
            </p>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              <LogOut size={15} />
              Sair
            </button>
          </div>
        ) : null}
      </div>

      {/* SIDEBAR DESKTOP SOBREPOSTA */}
      <aside className="group fixed left-0 top-0 z-40 hidden h-screen w-20 flex-col border-r border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:w-64 md:flex">
        <div className="mb-8 flex items-center gap-3 overflow-hidden">
          <img
            src="/icon-lembrei.png"
            alt="Lembrei"
            className="h-11 w-11 shrink-0 rounded-2xl bg-white shadow-sm"
          />

          <div className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <h1 className="text-2xl font-bold text-[#070D2D]">Lembrei</h1>
            <p className="text-sm text-slate-500">Cobrança automática</p>
          </div>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                <Icon size={19} className="shrink-0" />
                <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {item.label}
                </span>
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-auto space-y-3 pt-8">
          <div className="overflow-visible">
  <div className="flex items-center gap-3 rounded-2xl px-1 py-2 transition group-hover:bg-[#5B4BFF]/10">
    <div className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5B4BFF] text-sm font-bold text-white shadow-sm">
      {userInitial}
    </div>

    <div className="min-w-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <p className="text-xs text-slate-500">Usuário atual</p>
      <p className="truncate text-sm font-semibold text-[#070D2D]">
        {userName}
      </p>
    </div>
  </div>
</div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <LogOut size={18} className="shrink-0" />

            <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Sair
            </span>
          </button>
        </div>
      </aside>

      <main className="min-h-screen p-4 pt-20 md:p-8 md:pl-28">
        <Outlet />
      </main>
    </div>
  )
}