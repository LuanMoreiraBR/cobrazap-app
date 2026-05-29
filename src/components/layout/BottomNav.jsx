import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Wallet,
  BellRing,
  FileText,
  CreditCard,
  PlugZap,
  LogOut,
  Menu,
} from 'lucide-react'

const bottomItems = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/clientes', label: 'Clientes', icon: Users },
  { to: '/app/cobrancas', label: 'Cobranças', icon: Wallet },
  { to: '/app/automacoes', label: 'Automações', icon: BellRing },
]

const drawerGroups = [
  {
    title: 'Principal',
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/app/clientes', label: 'Clientes', icon: Users },
      { to: '/app/cobrancas', label: 'Cobranças', icon: Wallet },
      { to: '/app/automacoes', label: 'Automações', icon: BellRing },
      { to: '/app/templates', label: 'Templates', icon: FileText },
    ],
  },
  {
    title: 'Conta',
    items: [
      { to: '/app/plano', label: 'Plano', icon: CreditCard },
      { to: '/app/configuracoes', label: 'Configurações', icon: PlugZap },
    ],
  },
]

export default function BottomNav({ userName, hasPaidPlan, onLogout }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  function closeDrawer() {
    setDrawerOpen(false)
  }

  return (
    <>
      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-stretch h-16 bg-white border-t border-slate-200">
        {bottomItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="flex-1 flex flex-col items-center justify-center gap-1"
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={20}
                    className={
                      isActive
                        ? 'text-[#5B4BFF] [filter:drop-shadow(0_0_4px_rgba(91,75,255,0.5))]'
                        : 'text-slate-500 opacity-45'
                    }
                  />
                  <span
                    className={`text-[10px] font-medium ${
                      isActive ? 'text-[#5B4BFF]' : 'text-slate-500 opacity-45'
                    }`}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}

        {/* Menu button — opens drawer */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-slate-500 opacity-45 hover:opacity-100 transition-opacity"
        >
          <Menu size={20} />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </nav>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={closeDrawer}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Drawer panel */}
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img src="/icon-lembrei.png" alt="Lembrei" className="h-9 w-9 rounded-xl" />
                <div>
                  <p className="font-bold text-[#070D2D]">Lembrei</p>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-slate-400 opacity-40">
                    Cobrança automática
                  </p>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav
              className="py-3 px-3 space-y-5 overflow-y-auto"
              style={{ height: 'calc(100dvh - 160px)' }}
            >
              {drawerGroups.map((group) => (
                <div key={group.title}>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-slate-400 px-3 mb-1">
                    {group.title}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isPlanItem = item.to === '/app/plano' && !hasPaidPlan
                      return (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            end={item.end}
                            onClick={closeDrawer}
                            className="block"
                          >
                            {({ isActive }) => (
                              <div
                                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                                  isActive
                                    ? 'bg-[#5B4BFF]/10 text-[#5B4BFF]'
                                    : 'text-slate-700 opacity-[0.55] hover:opacity-100 hover:bg-slate-50'
                                }`}
                              >
                                <Icon
                                  size={18}
                                  className={isPlanItem ? 'plan-shake text-orange-500' : ''}
                                />
                                <span className={isPlanItem ? 'font-bold text-orange-500' : ''}>
                                  {item.label}
                                </span>
                                {isActive && (
                                  <span
                                    className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 bg-[#5B4BFF] rounded-l"
                                    style={{ height: 16 }}
                                  />
                                )}
                              </div>
                            )}
                          </NavLink>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>

            {/* Footer */}
            <div className="mt-auto px-4 py-4 border-t border-slate-100">
              <p className="text-sm font-bold text-[#070D2D] truncate">{userName}</p>
              <p className="text-xs text-slate-400 capitalize opacity-40">Cobrador</p>
              <button
                type="button"
                onClick={onLogout}
                className="mt-3 w-full flex items-center justify-start gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
