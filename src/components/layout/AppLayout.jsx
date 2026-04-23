import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Wallet, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const navClass = ({ isActive }) =>
  `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-slate-900 text-white'
      : 'text-slate-700 hover:bg-slate-100'
  }`

export default function AppLayout() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
        <aside className="border-r border-slate-200 bg-white p-5">
          <Link to="/" className="mb-8 block">
            <h1 className="text-2xl font-bold">Cobrança App</h1>
            <p className="text-sm text-slate-500">MVP para autônomos</p>
          </Link>

          <nav className="space-y-2">
            <NavLink to="/" end className={navClass}>
              <LayoutDashboard size={18} />
              Dashboard
            </NavLink>

            <NavLink to="/clientes" className={navClass}>
              <Users size={18} />
              Clientes
            </NavLink>

            <NavLink to="/cobrancas" className={navClass}>
              <Wallet size={18} />
              Cobranças
            </NavLink>
          </nav>

          <div className="mt-10 rounded-2xl bg-slate-100 p-4">
            <p className="text-sm text-slate-500">Usuário atual</p>
            <p className="font-semibold">{user?.email ?? 'Não logado'}</p>
          </div>

          <button
            onClick={handleLogout}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <LogOut size={16} />
            Sair
          </button>
        </aside>

        <main className="p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}