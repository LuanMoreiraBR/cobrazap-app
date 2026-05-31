import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Wallet, BellRing, FileText, CreditCard, PlugZap, LogOut, Smartphone } from 'lucide-react'
import InstallModal from '../InstallModal'

const navGroups = [
  {
    title: 'Principal',
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/app/clientes', label: 'Clientes', icon: Users, tourId: 'nav-clientes' },
      { to: '/app/cobrancas', label: 'Cobranças', icon: Wallet, tourId: 'nav-cobrancas' },
      { to: '/app/automacoes', label: 'Automações', icon: BellRing, tourId: 'nav-automacoes' },
      { to: '/app/templates', label: 'Templates', icon: FileText, tourId: 'nav-templates' },
    ],
  },
  {
    title: 'Conta',
    items: [
      { to: '/app/plano', label: 'Plano', icon: CreditCard },
      { to: '/app/configuracoes', label: 'Configurações', icon: PlugZap, tourId: 'nav-configuracoes' },
    ],
  },
]

export default function Sidebar({ userName, hasPaidPlan, onLogout }) {
  const [showInstall, setShowInstall] = useState(false)

  return (
    <>
      {/* Desktop sidebar — flex child in the h-screen container */}
      <aside className="hidden md:flex flex-col w-56 border-r border-slate-200 bg-white overflow-y-auto shrink-0">
        {/* Header */}
        <div className="px-4 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img src="/icon-lembrei.png" alt="Lembrei" className="h-10 w-10 rounded-xl" />
            <div>
              <p className="text-[17px] font-bold text-[#070D2D]">Lembrei</p>
              <p className="text-[10px] uppercase tracking-[0.1em] text-slate-400">
                Cobrança automática
              </p>
            </div>
          </div>
        </div>

        {/* Decorative gradient line */}
        <div className="h-px bg-gradient-to-r from-[rgba(91,75,255,0.2)] to-transparent" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
          {navGroups.map((group) => (
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
                      <NavLink to={item.to} end={item.end} className="block">
                        {({ isActive }) => (
                          <div
                            data-tour={item.tourId}
                            className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${
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
        <div className="px-4 py-4 border-t border-slate-100">
          <p className="text-sm font-bold text-[#070D2D] truncate">{userName}</p>
          <p className="text-xs text-slate-400 capitalize opacity-40">Cobrador</p>
          <button
            type="button"
            onClick={() => setShowInstall(true)}
            className="mt-2 w-full flex items-center justify-start gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#5B4BFF] hover:bg-[#5B4BFF]/10 transition"
          >
            <Smartphone size={16} />
            Instalar app
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="mt-1 w-full flex items-center justify-start gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {showInstall && <InstallModal onClose={() => setShowInstall(false)} />}

      {/* Mobile top bar — fixed overlay */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center justify-center bg-white border-b border-slate-200">
        <img src="/icon-lembrei.png" alt="Lembrei" className="h-[30px] w-[30px] rounded-xl mr-2" />
        <span className="text-base font-bold text-[#070D2D]">Lembrei</span>
      </div>
    </>
  )
}
