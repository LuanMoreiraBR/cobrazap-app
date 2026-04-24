import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Wallet } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import { useAuth } from '../contexts/AuthContext'
import { getCharges } from '../services/chargesService'
import { formatCurrency } from '../utils/format'

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
          : charge.status,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Visão geral das cobranças e lembretes automáticos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Em aberto" value={pending.length} icon={Clock3} />
        <StatCard title="Atrasadas" value={overdue.length} icon={AlertTriangle} />
        <StatCard title="Pagas" value={paid.length} icon={CheckCircle2} />
        <StatCard title="Vencem hoje" value={dueToday.length} icon={Clock3} />
        <StatCard title="Total em aberto" value={formatCurrency(totalOpen)} icon={Wallet} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-xl font-semibold text-[#070D2D]">Resumo financeiro</h2>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <span className="text-slate-600">Total recebido</span>
              <strong className="text-[#070D2D]">{formatCurrency(totalPaid)}</strong>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <span className="text-slate-600">Total pendente</span>
              <strong className="text-[#070D2D]">{formatCurrency(totalOpen)}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-[#070D2D]">Próximas cobranças</h2>

          <div className="mt-4 space-y-3">
            {loading ? (
              <p>Carregando cobranças...</p>
            ) : enrichedCharges.length === 0 ? (
              <p className="text-slate-500">Nenhuma cobrança cadastrada ainda.</p>
            ) : (
              enrichedCharges.map((charge) => (
                <div
                  key={charge.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-[#070D2D]">{charge.client?.name}</p>
                    <p className="text-sm text-slate-600">{charge.description}</p>
                  </div>

                  <div className="text-sm text-slate-500">
                    {charge.due_date} • {formatCurrency(charge.amount)}
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