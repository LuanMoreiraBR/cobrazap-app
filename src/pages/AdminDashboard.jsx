import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  RefreshCw,
  Search,
  Settings2,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { getAdminDashboard, runAdminUserAction } from '../services/adminService'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../utils/format'

const ADMIN_SECTIONS = [
  {
    id: 'overview',
    label: 'Visão geral',
    icon: LayoutDashboard,
  },
  {
    id: 'users',
    label: 'Usuários',
    icon: Users,
  },
  {
    id: 'operation',
    label: 'Operação',
    icon: Activity,
  },
  {
    id: 'credits',
    label: 'Compras',
    icon: CreditCard,
  },
  {
    id: 'history',
    label: 'Histórico admin',
    icon: History,
  },
]

function AdminCard({ title, value, subtitle, icon: Icon, tone = 'purple' }) {
  const tones = {
    purple: 'bg-[#5B4BFF]/10 text-[#5B4BFF] ring-[#5B4BFF]/20',
    green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    red: 'bg-red-100 text-red-700 ring-red-200',
    amber: 'bg-amber-100 text-amber-700 ring-amber-200',
    blue: 'bg-blue-100 text-blue-700 ring-blue-200',
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-black text-[#070D2D]">{value}</p>

          {subtitle ? (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        <div className={`rounded-2xl p-3 ring-1 ${tones[tone]}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

function SimpleBars({ data }) {
  const safeData = data || []
  const max = Math.max(...safeData.map((item) => Number(item.value || 0)), 1)

  return (
    <div className="space-y-2">
      {safeData.length === 0 ? (
        <p className="text-sm text-slate-500">Sem dados para exibir.</p>
      ) : (
        safeData.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>

            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-[#5B4BFF]"
                style={{
                  width: `${Math.max((Number(item.value || 0) / max) * 100, 3)}%`,
                }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function StatusPill({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-[#5B4BFF]/10 text-[#5B4BFF]',
    blue: 'bg-blue-100 text-blue-700',
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  )
}

function AdminSidebar({ activeSection, setActiveSection, onLogout }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-200 bg-white p-5 lg:block">
      <div className="flex items-center gap-3">
        <img
          src="/icon-lembrei.png"
          alt="Lembrei"
          className="h-11 w-11 rounded-2xl"
        />

        <div>
          <p className="text-lg font-black text-[#070D2D]">Lembrei</p>
          <p className="text-xs font-bold text-slate-400">Admin Master</p>
        </div>
      </div>

      <nav className="mt-8 space-y-2">
        {ADMIN_SECTIONS.map((section) => {
          const Icon = section.icon
          const active = activeSection === section.id

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                active
                  ? 'bg-[#5B4BFF] text-white shadow-lg shadow-[#5B4BFF]/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-[#070D2D]'
              }`}
            >
              <Icon size={18} />
              {section.label}
            </button>
          )
        })}
      </nav>

      <div className="absolute bottom-5 left-5 right-5">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-[#070D2D] hover:bg-slate-200"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  )
}

function AdminMobileTabs({ activeSection, setActiveSection }) {
  return (
    <div className="overflow-x-auto rounded-3xl bg-white p-2 shadow-sm ring-1 ring-slate-200 lg:hidden">
      <div className="flex min-w-max gap-2">
        {ADMIN_SECTIONS.map((section) => {
          const Icon = section.icon
          const active = activeSection === section.id

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${
                active
                  ? 'bg-[#5B4BFF] text-white'
                  : 'bg-slate-50 text-slate-600'
              }`}
            >
              <Icon size={16} />
              {section.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function getActionLabel(action) {
  const labels = {
    ADD_CREDITS: 'Adicionou créditos',
    CHANGE_PLAN: 'Alterou plano',
    SET_SUBSCRIPTION_STATUS: 'Alterou assinatura',
    BLOCK_USER: 'Bloqueou usuário',
    UNBLOCK_USER: 'Desbloqueou usuário',
  }

  return labels[action] || action
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const [activeSection, setActiveSection] = useState('overview')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoadingUserId, setActionLoadingUserId] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [specialFilter, setSpecialFilter] = useState('all')

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function load() {
    setError('')
    setLoading(true)

    try {
      const result = await getAdminDashboard()
      setData(result)
    } catch (err) {
      setError(err.message || 'Erro ao carregar painel admin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function runUserAction(payload) {
    const confirmMessage =
      payload.action === 'ADD_CREDITS'
        ? `Adicionar ${payload.quantity} créditos para este usuário?`
        : payload.action === 'CHANGE_PLAN'
          ? `Alterar plano deste usuário para ${payload.plan_id}?`
          : payload.action === 'SET_SUBSCRIPTION_STATUS'
            ? `Alterar status da assinatura para ${payload.status}?`
            : payload.action === 'BLOCK_USER'
              ? 'Bloquear este usuário?'
              : payload.action === 'UNBLOCK_USER'
                ? 'Desbloquear este usuário?'
                : 'Executar esta ação?'

    if (!window.confirm(confirmMessage)) return

    setActionLoadingUserId(payload.target_user_id)
    setError('')

    try {
      await runAdminUserAction(payload)
      await load()
    } catch (err) {
      setError(err.message || 'Erro ao executar ação.')
    } finally {
      setActionLoadingUserId(null)
    }
  }

  const twilioBalance = useMemo(() => {
    if (!data?.twilio?.available) return 'Indisponível'

    return `${data.twilio.currency || ''} ${data.twilio.balance}`
  }, [data])

  const planOptions = useMemo(() => {
    const users = data?.users_detailed || []
    const plans = new Set(users.map((item) => item.plan).filter(Boolean))

    return Array.from(plans)
  }, [data])

  const filteredUsers = useMemo(() => {
    const users = data?.users_detailed || []
    const search = searchTerm.trim().toLowerCase()

    return users.filter((item) => {
      const matchesSearch =
        !search ||
        item.name?.toLowerCase().includes(search) ||
        item.email?.toLowerCase().includes(search)

      const matchesPlan = planFilter === 'all' || item.plan === planFilter

      const matchesStatus =
        statusFilter === 'all' ||
        item.subscription_status === statusFilter ||
        (statusFilter === 'blocked' && item.is_blocked)

      const matchesSpecial =
        specialFilter === 'all' ||
        (specialFilter === 'blocked' && item.is_blocked) ||
        (specialFilter === 'near_limit' && item.near_limit) ||
        (specialFilter === 'at_limit' && item.at_limit) ||
        (specialFilter === 'with_credits' && Number(item.extra_credits || 0) > 0) ||
        (specialFilter === 'without_messages' && Number(item.messages_used || 0) === 0)

      return matchesSearch && matchesPlan && matchesStatus && matchesSpecial
    })
  }, [data, searchTerm, planFilter, statusFilter, specialFilter])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <div className="mx-auto mb-5 h-11 w-11 animate-spin rounded-full border-4 border-[#5B4BFF]/20 border-t-[#5B4BFF]" />
          <p className="text-sm font-bold text-[#070D2D]">
            Carregando painel administrativo...
          </p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>
      </div>
    )
  }

  const summary = data.summary
  const funnel = data.funnel

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onLogout={handleLogout}
      />

      <main className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 rounded-3xl bg-[#070D2D] p-6 text-white shadow-xl md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">
                Lembrei Admin
              </p>

              <h1 className="mt-2 text-3xl font-black">
                Painel administrativo
              </h1>

              <p className="mt-1 text-sm text-slate-300">
                Usuários, receita, mensagens, créditos, Twilio e saúde operacional.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#070D2D] hover:bg-slate-100"
              >
                <RefreshCw size={16} />
                Atualizar
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15 lg:hidden"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>

          <AdminMobileTabs
            activeSection={activeSection}
            setActiveSection={setActiveSection}
          />

          {error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          {activeSection === 'overview' ? (
            <>
              {(summary.scheduled_failed > 0 ||
                summary.users_at_limit > 0 ||
                data.twilio?.error) ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 shrink-0" size={20} />

                    <div>
                      <p className="font-black">Atenção operacional</p>

                      <p className="mt-1">
                        {summary.scheduled_failed > 0
                          ? `${summary.scheduled_failed} mensagens agendadas falharam. `
                          : ''}
                        {summary.users_at_limit > 0
                          ? `${summary.users_at_limit} usuários atingiram o limite. `
                          : ''}
                        {data.twilio?.error ? `Twilio: ${data.twilio.error}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <AdminCard
                  title="MRR estimado"
                  value={formatCurrency(summary.mrr_estimated || 0)}
                  subtitle="Soma dos planos ativos"
                  icon={TrendingUp}
                  tone="green"
                />

                <AdminCard
                  title="Receita mês"
                  value={formatCurrency(summary.revenue_month_total || 0)}
                  subtitle={`${formatCurrency(summary.plan_revenue_month || 0)} planos + ${formatCurrency(summary.credit_revenue_month || 0)} créditos`}
                  icon={CreditCard}
                  tone="purple"
                />

                <AdminCard
                  title="Pagamentos pendentes"
                  value={
                    Number(summary.platform_payments_pending || 0) +
                    Number(summary.credit_purchases_pending || 0)
                  }
                  subtitle="Planos e créditos aguardando pagamento"
                  icon={Wallet}
                  tone="amber"
                />

                <AdminCard
                  title="Saldo Twilio"
                  value={twilioBalance}
                  subtitle={data.twilio?.error || 'Saldo da conta principal'}
                  icon={Wallet}
                  tone={data.twilio?.available ? 'blue' : 'red'}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <AdminCard
                  title="Usuários totais"
                  value={summary.total_users}
                  subtitle={`${summary.users_created_month} criados este mês`}
                  icon={Users}
                />

                <AdminCard
                  title="Online agora"
                  value={summary.online_users}
                  subtitle="Ativos nos últimos 5 minutos"
                  icon={Activity}
                  tone="green"
                />

                <AdminCard
                  title="Assinaturas ativas"
                  value={summary.active_subscriptions}
                  subtitle={`${summary.trial_users} em teste grátis/inativos`}
                  icon={UserCheck}
                  tone="blue"
                />

                <AdminCard
                  title="Usuários no limite"
                  value={summary.users_at_limit}
                  subtitle={`${summary.users_near_limit} próximos do limite`}
                  icon={AlertTriangle}
                  tone={summary.users_at_limit > 0 ? 'red' : 'amber'}
                />
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-xl font-black text-[#070D2D]">
                  Funil de ativação
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Mostra onde os usuários estão avançando ou travando.
                </p>

                <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {[
                    ['Contas', funnel.accounts_created],
                    ['Com clientes', funnel.users_with_clients],
                    ['Com cobranças', funnel.users_with_charges],
                    ['Enviaram mensagens', funnel.users_with_messages],
                    ['Receberam pagamento', funnel.users_with_payments_received],
                    ['Assinaram', funnel.active_subscriptions],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <p className="text-xs font-bold text-slate-500">{label}</p>
                      <p className="mt-2 text-2xl font-black text-[#070D2D]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 xl:col-span-2">
                  <h2 className="text-xl font-black text-[#070D2D]">
                    Mensagens por dia
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Últimos 30 dias.
                  </p>

                  <div className="mt-6">
                    <SimpleBars data={data.charts.messages_by_day} />
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <h2 className="text-xl font-black text-[#070D2D]">
                    Planos ativos
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Distribuição atual por plano.
                  </p>

                  <div className="mt-6">
                    <SimpleBars
                      data={data.charts.plan_stats.map((item) => ({
                        label: item.plan,
                        value: item.total,
                      }))}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {activeSection === 'users' ? (
            <div className="space-y-4">
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-[#070D2D]">
                      Usuários da plataforma
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Filtros por nome, e-mail, plano, status, limite e créditos.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar usuário"
                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#5B4BFF] focus:ring-4 focus:ring-[#5B4BFF]/10"
                      />
                    </label>

                    <select
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#5B4BFF]"
                    >
                      <option value="all">Todos os planos</option>
                      {planOptions.map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#5B4BFF]"
                    >
                      <option value="all">Todos os status</option>
                      <option value="active">Ativo</option>
                      <option value="trial">Teste grátis</option>
                      <option value="inactive">Inativo</option>
                      <option value="pending">Pendente</option>
                      <option value="blocked">Bloqueado</option>
                    </select>

                    <select
                      value={specialFilter}
                      onChange={(e) => setSpecialFilter(e.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#5B4BFF]"
                    >
                      <option value="all">Todos</option>
                      <option value="blocked">Bloqueados</option>
                      <option value="near_limit">Perto do limite</option>
                      <option value="at_limit">No limite</option>
                      <option value="with_credits">Com créditos extras</option>
                      <option value="without_messages">Sem mensagens</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('')
                        setPlanFilter('all')
                        setStatusFilter('all')
                        setSpecialFilter('all')
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-[#070D2D] hover:bg-slate-200"
                    >
                      <Settings2 size={16} />
                      Limpar
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-sm font-bold text-slate-500">
                  Exibindo {filteredUsers.length} de {data.users_detailed.length} usuários.
                </p>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[1350px] text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-3">Usuário</th>
                        <th className="py-3">Plano</th>
                        <th className="py-3">Clientes</th>
                        <th className="py-3">Mensagens</th>
                        <th className="py-3">Créditos</th>
                        <th className="py-3">Cobranças</th>
                        <th className="py-3">Recebido</th>
                        <th className="py-3">Em aberto</th>
                        <th className="py-3">Última atividade</th>
                        <th className="py-3">Ações</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredUsers.map((item) => (
                        <tr key={item.user_id} className="border-b last:border-0">
                          <td className="py-3">
                            <p className="font-bold text-[#070D2D]">
                              {item.name || 'Sem nome'}
                            </p>
                            <p className="text-xs text-slate-500">{item.email}</p>
                          </td>

                          <td className="py-3">
                            <div className="space-y-1">
                              <StatusPill
                                tone={
                                  item.is_blocked
                                    ? 'red'
                                    : item.subscription_status === 'active'
                                      ? 'green'
                                      : 'slate'
                                }
                              >
                                {item.is_blocked ? 'Bloqueado' : item.plan}
                              </StatusPill>

                              <p className="text-xs text-slate-400">
                                {item.is_blocked
                                  ? item.blocked_reason || 'Usuário bloqueado'
                                  : item.subscription_status}
                              </p>
                            </div>
                          </td>

                          <td className="py-3">
                            {item.clients_count}/{item.client_limit || '∞'}
                          </td>

                          <td className="py-3">
                            <div className="space-y-1">
                              <p>
                                {item.messages_used}/{item.message_limit || '∞'}
                              </p>

                              {item.at_limit ? (
                                <StatusPill tone="red">limite atingido</StatusPill>
                              ) : item.near_limit ? (
                                <StatusPill tone="amber">perto do limite</StatusPill>
                              ) : null}
                            </div>
                          </td>

                          <td className="py-3">{item.extra_credits}</td>
                          <td className="py-3">{item.charges_count}</td>

                          <td className="py-3">
                            {formatCurrency(item.received_amount || 0)}
                          </td>

                          <td className="py-3">
                            {formatCurrency(item.open_amount || 0)}
                          </td>

                          <td className="py-3">
                            {item.last_seen_at
                              ? new Date(item.last_seen_at).toLocaleString('pt-BR')
                              : '-'}
                          </td>

                          <td className="py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={actionLoadingUserId === item.user_id}
                                onClick={() =>
                                  runUserAction({
                                    action: 'ADD_CREDITS',
                                    target_user_id: item.user_id,
                                    quantity: 50,
                                    note: 'Crédito manual pelo painel admin.',
                                  })
                                }
                                className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-200 disabled:opacity-60"
                              >
                                +50 créditos
                              </button>

                              <button
                                type="button"
                                disabled={actionLoadingUserId === item.user_id}
                                onClick={() =>
                                  runUserAction({
                                    action: 'CHANGE_PLAN',
                                    target_user_id: item.user_id,
                                    plan_id: 'scale',
                                    days: 30,
                                  })
                                }
                                className="rounded-xl bg-[#5B4BFF]/10 px-3 py-2 text-xs font-black text-[#5B4BFF] hover:bg-[#5B4BFF]/20 disabled:opacity-60"
                              >
                                Scale 30d
                              </button>

                              <button
                                type="button"
                                disabled={actionLoadingUserId === item.user_id}
                                onClick={() =>
                                  runUserAction({
                                    action: 'SET_SUBSCRIPTION_STATUS',
                                    target_user_id: item.user_id,
                                    status: 'inactive',
                                  })
                                }
                                className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-700 hover:bg-amber-200 disabled:opacity-60"
                              >
                                Inativar
                              </button>

                              {item.is_blocked ? (
                                <button
                                  type="button"
                                  disabled={actionLoadingUserId === item.user_id}
                                  onClick={() =>
                                    runUserAction({
                                      action: 'UNBLOCK_USER',
                                      target_user_id: item.user_id,
                                    })
                                  }
                                  className="rounded-xl bg-blue-100 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-200 disabled:opacity-60"
                                >
                                  Desbloquear
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={actionLoadingUserId === item.user_id}
                                  onClick={() =>
                                    runUserAction({
                                      action: 'BLOCK_USER',
                                      target_user_id: item.user_id,
                                      reason: 'Bloqueado manualmente pela administração.',
                                    })
                                  }
                                  className="rounded-xl bg-red-100 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-200 disabled:opacity-60"
                                >
                                  Bloquear
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === 'operation' ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <AdminCard
                  title="Mensagens hoje"
                  value={summary.messages_today}
                  subtitle="Envios registrados hoje"
                  icon={MessageCircle}
                />

                <AdminCard
                  title="Mensagens no mês"
                  value={summary.messages_month}
                  subtitle="Envios registrados no mês"
                  icon={MessageCircle}
                />

                <AdminCard
                  title="Mensagens no ano"
                  value={summary.messages_year}
                  subtitle="Envios registrados no ano"
                  icon={MessageCircle}
                />

                <AdminCard
                  title="Falhas agendadas"
                  value={summary.scheduled_failed}
                  subtitle={`${summary.scheduled_pending} pendentes, ${summary.scheduled_processing} processando`}
                  icon={AlertTriangle}
                  tone={summary.scheduled_failed > 0 ? 'red' : 'green'}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <AdminCard
                  title="Clientes totais"
                  value={summary.total_clients}
                  subtitle="Clientes cadastrados na plataforma"
                  icon={Users}
                />

                <AdminCard
                  title="Cobranças totais"
                  value={summary.total_charges}
                  subtitle="Cobranças criadas"
                  icon={CreditCard}
                />

                <AdminCard
                  title="Recebido pelos usuários"
                  value={formatCurrency(summary.total_received || 0)}
                  subtitle="Soma das cobranças pagas"
                  icon={Wallet}
                  tone="green"
                />

                <AdminCard
                  title="Em aberto"
                  value={formatCurrency(summary.total_open || 0)}
                  subtitle="Soma das cobranças pendentes/atrasadas"
                  icon={Wallet}
                  tone="amber"
                />
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-xl font-black text-[#070D2D]">
                  Mensagens por dia
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Últimos 30 dias.
                </p>

                <div className="mt-6">
                  <SimpleBars data={data.charts.messages_by_day} />
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === 'credits' ? (
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-[#070D2D]">
                Últimas compras de mensagens
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Pacotes comprados e créditos manuais adicionados.
              </p>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-3">Usuário</th>
                      <th className="py-3">Quantidade</th>
                      <th className="py-3">Restante</th>
                      <th className="py-3">Valor</th>
                      <th className="py-3">Status</th>
                      <th className="py-3">Criado em</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.credit_purchases.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-3">
                          <p className="font-bold text-[#070D2D]">
                            {item.user_name || 'Sem nome'}
                          </p>

                          <p className="text-xs text-slate-500">
                            {item.user_email || item.user_id}
                          </p>
                        </td>

                        <td className="py-3">{item.quantity}</td>
                        <td className="py-3">{item.remaining}</td>
                        <td className="py-3">
                          {formatCurrency(item.amount || 0)}
                        </td>
                        <td className="py-3">{item.status}</td>
                        <td className="py-3">
                          {new Date(item.created_at).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeSection === 'history' ? (
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-black text-[#070D2D]">
                Histórico de ações administrativas
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Auditoria das alterações manuais feitas por administradores.
              </p>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-3">Data</th>
                      <th className="py-3">Admin</th>
                      <th className="py-3">Usuário afetado</th>
                      <th className="py-3">Ação</th>
                      <th className="py-3">Detalhes</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(data.admin_actions || []).length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-5 text-slate-500">
                          Nenhuma ação administrativa registrada ainda.
                        </td>
                      </tr>
                    ) : (
                      data.admin_actions.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-3">
                            {new Date(item.created_at).toLocaleString('pt-BR')}
                          </td>

                          <td className="py-3">
                            <p className="font-bold text-[#070D2D]">
                              {item.admin_name || 'Admin'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.admin_email || item.admin_user_id}
                            </p>
                          </td>

                          <td className="py-3">
                            <p className="font-bold text-[#070D2D]">
                              {item.target_name || 'Sem usuário'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.target_email || item.target_user_id || '-'}
                            </p>
                          </td>

                          <td className="py-3">
                            <StatusPill tone="purple">
                              {getActionLabel(item.action)}
                            </StatusPill>
                          </td>

                          <td className="py-3">
                            <pre className="max-w-md whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                              {JSON.stringify(item.payload || {}, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}