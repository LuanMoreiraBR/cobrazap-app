import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getCharges } from '../services/chargesService'
import { formatCurrency, formatDate } from '../utils/format'

function isToday(dateString) {
  const today = new Date()
  const date = new Date(dateString + 'T00:00:00')

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function isOverdue(charge) {
  if (charge.status === 'pago') return false

  const today = new Date()
  const due = new Date(charge.due_date + 'T00:00:00')

  return due < new Date(today.getFullYear(), today.getMonth(), today.getDate())
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

  useEffect(() => {
    async function loadCharges() {
      try {
        const data = await getCharges(user.id)
        setCharges(data)
      } catch (error) {
        console.error(error.message)
      } finally {
        setLoading(false)
      }
    }

    if (user?.id) loadCharges()
  }, [user])

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

  const pending = enrichedCharges.filter((item) => item.computedStatus === 'pendente')
  const overdue = enrichedCharges.filter((item) => item.computedStatus === 'atrasado')
  const paid = enrichedCharges.filter((item) => item.computedStatus === 'pago')
  const dueToday = enrichedCharges.filter(
    (item) => item.computedStatus !== 'pago' && isToday(item.due_date),
  )

  const totalOpen = [...pending, ...overdue].reduce(
    (acc, item) => acc + Number(item.amount),
    0,
  )

  const totalPaid = paid.reduce((acc, item) => acc + Number(item.amount), 0)
  const totalGeneral = totalOpen + totalPaid
  const paidPercent = totalGeneral > 0 ? Math.round((totalPaid / totalGeneral) * 100) : 0
  const openPercent = totalGeneral > 0 ? Math.round((totalOpen / totalGeneral) * 100) : 0

  const nextCharges = [...enrichedCharges]
    .filter((charge) => charge.computedStatus !== 'pago')
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 6)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-[#070D2D] via-[#161B4D] to-[#5B4BFF] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#AFA8FF]">
              Painel financeiro
            </p>
            <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              Acompanhe cobranças, recebimentos, atrasos e lembretes em um painel claro e profissional.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
            <p className="text-sm text-slate-200">Total recebido</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(totalPaid)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardCard
          title="Em aberto"
          value={pending.length}
          subtitle={formatCurrency(pending.reduce((acc, item) => acc + Number(item.amount), 0))}
          icon={Clock3}
          color="amber"
        />

        <DashboardCard
          title="Atrasadas"
          value={overdue.length}
          subtitle={formatCurrency(overdue.reduce((acc, item) => acc + Number(item.amount), 0))}
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
                Distribuição entre valores recebidos e pendentes.
              </p>
            </div>

            <div className="rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF]">
              <TrendingUp size={22} />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-emerald-700">Total recebido</span>
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
                <span className="font-medium text-amber-700">Total pendente</span>
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
                Cobranças pendentes ordenadas por vencimento.
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
                  Quando houver cobranças abertas, elas aparecerão aqui.
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