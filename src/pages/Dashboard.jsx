import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import PeriodFilter, {
  getTodayInputDate,
  isInsidePeriod,
} from '../components/ui/PeriodFilter'
import { useAuth } from '../contexts/AuthContext'
import { getCharges } from '../services/chargesService'
import { formatCurrency, formatDate } from '../utils/format'
import { getUsageSummary } from '../services/usageService'

function isToday(dateString) {
  const today = new Date()
  const date = new Date(`${dateString}T00:00:00`)

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function isOverdue(charge) {
  if (charge.status === 'pago') return false

  const today = new Date()
  const due = new Date(`${charge.due_date}T00:00:00`)

  return due < new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

function getDaysUntilDate(value) {
  if (!value) return null

  const now = new Date()
  const end = new Date(value)

  now.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const diff = end.getTime() - now.getTime()

  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatShortDate(value) {
  if (!value) return ''

  return new Date(value).toLocaleDateString('pt-BR')
}

function getUsagePresentation(usage) {
  if (!usage) {
    return {
      planName: 'Carregando...',
      messagesLabel: '0/10',
      clientsLabel: '0/10',
      messageSubtitle: 'Teste grátis',
      clientSubtitle: 'Limite disponível',
      canCreateClient: true,
      canSendMessage: true,
      hasActivePlan: false,
      extraCredits: 0,
      isNearLimit: false,
      isAtLimit: false,
    }
  }

  const hasActivePlan = Boolean(usage.hasActivePlan)
  const planName = hasActivePlan ? usage.plan?.name || 'Plano ativo' : 'Teste grátis'

  const messageLimit = Number(usage.messageLimit || 0)
  const extraCredits = Number(usage.extraCredits || 0)
  const messagesUsed = Number(usage.messagesUsed || 0)

  const totalMessageLimit =
    Number(usage.totalMessageLimit || 0) || messageLimit + extraCredits

  const clientLimit = Number(usage.clientLimit || 0)
  const clientsUsed = Number(usage.clientsUsed || 0)

  const percentUsed =
    totalMessageLimit > 0 ? Math.round((messagesUsed / totalMessageLimit) * 100) : 0

  return {
    planName,
    messagesLabel:
      totalMessageLimit > 0 ? `${messagesUsed}/${totalMessageLimit}` : `${messagesUsed}/∞`,
    clientsLabel: clientLimit > 0 ? `${clientsUsed}/${clientLimit}` : `${clientsUsed}/∞`,
    messageSubtitle:
      extraCredits > 0
        ? `+${extraCredits} mensagens extras disponíveis`
        : hasActivePlan
          ? planName
          : 'Teste grátis',
    clientSubtitle: usage.canCreateClient ? 'Limite disponível' : 'Limite atingido',
    canCreateClient: Boolean(usage.canCreateClient),
    canSendMessage: Boolean(usage.canSendMessage),
    hasActivePlan,
    extraCredits,
    isNearLimit: totalMessageLimit > 0 && percentUsed >= 80 && percentUsed < 100,
    isAtLimit: totalMessageLimit > 0 && messagesUsed >= totalMessageLimit,
  }
}

function DashboardCard({ title, value, subtitle, icon: Icon, color }) {
  const colors = {
    purple: 'bg-[#5B4BFF]/10 text-[#5B4BFF] ring-[#5B4BFF]/20',
    amber: 'bg-amber-100 text-amber-700 ring-amber-200',
    green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    red: 'bg-red-100 text-red-700 ring-red-200',
    blue: 'bg-blue-100 text-blue-700 ring-blue-200',
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold text-[#070D2D]">{value}</p>

          {subtitle ? (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        <div className={`rounded-2xl p-3 ring-1 ${colors[color]}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    pago: 'bg-emerald-100 text-emerald-700',
    atrasado: 'bg-red-100 text-red-700',
    pendente: 'bg-amber-100 text-amber-700',
  }

  const labels = {
    pago: 'Pago',
    atrasado: 'Atrasado',
    pendente: 'Pendente',
  }

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export default function Dashboard() {
  const { user } = useAuth()

  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [referenceDate, setReferenceDate] = useState(getTodayInputDate())
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    async function loadDashboard() {
      if (!user?.id) return

      setLoading(true)

      try {
        const [chargesData, usageData] = await Promise.all([
          getCharges(user.id),
          getUsageSummary(user.id),
        ])

        setCharges(chargesData || [])
        setUsage(usageData)
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [user?.id])

  const usageInfo = useMemo(() => getUsagePresentation(usage), [usage])

  const subscription = usage?.subscription || null
  const planDaysUntilEnd = getDaysUntilDate(subscription?.current_period_end)

  const showPlanExpirationWarning =
    usage?.hasActivePlan &&
    planDaysUntilEnd !== null &&
    planDaysUntilEnd >= 0 &&
    planDaysUntilEnd <= 3

  const enrichedCharges = useMemo(() => {
    return charges.map((charge) => ({
      ...charge,
      computedStatus:
        charge.status === 'pago'
          ? 'pago'
          : isOverdue(charge)
            ? 'atrasado'
            : 'pendente',
    }))
  }, [charges])

  const periodCharges = useMemo(() => {
    return enrichedCharges.filter((charge) =>
      isInsidePeriod(charge.created_at || charge.due_date, period, referenceDate),
    )
  }, [enrichedCharges, period, referenceDate])

  const pending = periodCharges.filter((item) => item.computedStatus === 'pendente')
  const overdue = periodCharges.filter((item) => item.computedStatus === 'atrasado')
  const paid = periodCharges.filter((item) => item.computedStatus === 'pago')
  const dueToday = periodCharges.filter(
    (item) => item.computedStatus !== 'pago' && isToday(item.due_date),
  )

  const totalOpen = [...pending, ...overdue].reduce(
    (acc, item) => acc + Number(item.amount || 0),
    0,
  )

  const totalPaid = paid.reduce((acc, item) => acc + Number(item.amount || 0), 0)
  const totalGeneral = totalOpen + totalPaid

  const paidPercent =
    totalGeneral > 0 ? Math.round((totalPaid / totalGeneral) * 100) : 0

  const openPercent =
    totalGeneral > 0 ? Math.round((totalOpen / totalGeneral) * 100) : 0

  const nextCharges = [...periodCharges]
    .filter((charge) => charge.computedStatus !== 'pago')
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 6)

  return (
    <div className="space-y-6">
      {showPlanExpirationWarning ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-black">
                Seu plano vence em {planDaysUntilEnd}{' '}
                {planDaysUntilEnd === 1 ? 'dia' : 'dias'}.
              </p>

              <p className="mt-1 text-sm">
                Vencimento em {formatShortDate(subscription?.current_period_end)}.
                Renove para manter seu acesso sem interrupção.
              </p>
            </div>

            <Link
              to="/app/plano"
              className="inline-flex items-center justify-center rounded-2xl bg-[#5B4BFF] px-5 py-3 text-sm font-black text-white hover:bg-[#4A3BE8]"
            >
              Ver plano
            </Link>
          </div>
        </div>
      ) : null}

      {usageInfo.hasActivePlan && usageInfo.isNearLimit ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Atenção:</strong> você está perto do limite de mensagens do mês.
          Você pode comprar créditos extras para continuar enviando cobranças.
        </div>
      ) : null}

      {usageInfo.hasActivePlan && usageInfo.isAtLimit ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Limite atingido:</strong> suas mensagens do mês acabaram.
          Compre créditos extras ou altere seu plano para continuar enviando.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5B4BFF]">
            Painel financeiro
          </p>

          <h1 className="mt-1 text-2xl font-bold text-[#070D2D]">Dashboard</h1>

          <p className="mt-1 text-sm text-slate-500">
            Visão geral das cobranças, recebimentos e indicadores.
          </p>
        </div>

        <div className="hidden rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF] md:block">
          <Wallet size={22} />
        </div>
      </div>

      <PeriodFilter
        period={period}
        setPeriod={setPeriod}
        referenceDate={referenceDate}
        setReferenceDate={setReferenceDate}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardCard
          title="Mensagens do mês"
          value={usageInfo.messagesLabel}
          subtitle={usageInfo.messageSubtitle}
          icon={Clock3}
          color={usageInfo.isAtLimit ? 'red' : usageInfo.isNearLimit ? 'amber' : 'purple'}
        />

        <DashboardCard
          title="Clientes cadastrados"
          value={usageInfo.clientsLabel}
          subtitle={usageInfo.clientSubtitle}
          icon={Users}
          color={usageInfo.canCreateClient ? 'blue' : 'red'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardCard
          title="Em aberto"
          value={pending.length}
          subtitle={formatCurrency(
            pending.reduce((acc, item) => acc + Number(item.amount || 0), 0),
          )}
          icon={Clock3}
          color="amber"
        />

        <DashboardCard
          title="Atrasadas"
          value={overdue.length}
          subtitle={formatCurrency(
            overdue.reduce((acc, item) => acc + Number(item.amount || 0), 0),
          )}
          icon={AlertTriangle}
          color="red"
        />

        <DashboardCard
          title="Pagas"
          value={paid.length}
          subtitle={formatCurrency(totalPaid)}
          icon={CheckCircle2}
          color="green"
        />

        <DashboardCard
          title="Vencem hoje"
          value={dueToday.length}
          subtitle="Atenção aos lembretes"
          icon={CalendarClock}
          color="blue"
        />

        <DashboardCard
          title="Total em aberto"
          value={formatCurrency(totalOpen)}
          subtitle={`${openPercent}% do total`}
          icon={Wallet}
          color="purple"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#070D2D]">
                Resumo financeiro
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Distribuição entre valores recebidos e pendentes no período.
              </p>
            </div>

            <div className="rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF]">
              <TrendingUp size={22} />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-emerald-700">
                  Total recebido
                </span>

                <strong className="text-lg text-emerald-700">
                  {formatCurrency(totalPaid)}
                </strong>
              </div>

              <div className="mt-3 h-2 rounded-full bg-white">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${paidPercent}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-emerald-700">
                {paidPercent}% do total financeiro
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-amber-700">
                  Total pendente
                </span>

                <strong className="text-lg text-amber-700">
                  {formatCurrency(totalOpen)}
                </strong>
              </div>

              <div className="mt-3 h-2 rounded-full bg-white">
                <div
                  className="h-2 rounded-full bg-amber-500"
                  style={{ width: `${openPercent}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-amber-700">
                {openPercent}% ainda precisa ser recebido
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-600">Total geral</span>

                <strong className="text-lg text-[#070D2D]">
                  {formatCurrency(totalGeneral)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#070D2D]">
                Próximas cobranças
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Cobranças pendentes do período selecionado.
              </p>
            </div>

            <span className="badge">{nextCharges.length} próximas</span>
          </div>

          <div className="mt-6 space-y-3">
            {loading ? (
              <p>Carregando cobranças...</p>
            ) : nextCharges.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                <CheckCircle2 className="mx-auto text-emerald-500" size={32} />

                <p className="mt-3 font-semibold text-[#070D2D]">
                  Nenhuma cobrança pendente
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Quando houver cobranças abertas no período, elas aparecerão aqui.
                </p>
              </div>
            ) : (
              nextCharges.map((charge) => (
                <div
                  key={charge.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-[#5B4BFF]/40 hover:bg-[#5B4BFF]/5 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#070D2D]">
                        {charge.client?.name}
                      </p>

                      <StatusBadge status={charge.computedStatus} />
                    </div>

                    <p className="mt-1 text-sm text-slate-600">
                      {charge.description}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-sm font-semibold text-[#070D2D]">
                      {formatCurrency(charge.amount)}
                    </p>

                    <p className="text-sm text-slate-500">
                      {formatDate(charge.due_date)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
