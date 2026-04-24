import { useEffect, useMemo, useState } from 'react'
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MessageCircle,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getScheduledMessages } from '../services/automationService'
import { formatCurrency, formatDate, formatPhone } from '../utils/format'

function getStatusConfig(status) {
  if (status === 'sent') {
    return {
      label: 'Enviada',
      className: 'bg-emerald-100 text-emerald-700',
      icon: CheckCircle2,
    }
  }

  if (status === 'failed') {
    return {
      label: 'Falhou',
      className: 'bg-red-100 text-red-700',
      icon: XCircle,
    }
  }

  if (status === 'cancelled') {
    return {
      label: 'Cancelada',
      className: 'bg-slate-100 text-slate-700',
      icon: XCircle,
    }
  }

  return {
    label: 'Pendente',
    className: 'bg-amber-100 text-amber-700',
    icon: Clock3,
  }
}

function getMessageLabel(type) {
  if (type === 'professional') return 'Profissional'
  if (type === 'urgent') return 'Urgente'
  return 'Amigável'
}

function StatBox({ title, value, icon: Icon, className }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-[#070D2D]">{value}</p>
        </div>

        <div className={`rounded-2xl p-3 ${className}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

export default function Automations() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadItems() {
      try {
        if (!user?.id) return
        const data = await getScheduledMessages(user.id)
        setItems(data)
      } catch (err) {
        setError(err.message || 'Erro ao carregar automações')
      } finally {
        setLoading(false)
      }
    }

    loadItems()
  }, [user])

  const stats = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((item) => item.status === 'pending').length,
      sent: items.filter((item) => item.status === 'sent').length,
      failed: items.filter((item) => item.status === 'failed').length,
    }
  }, [items])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-[#070D2D] via-[#161B4D] to-[#5B4BFF] p-6 text-white shadow-sm">
        <p className="text-sm font-semibold text-[#AFA8FF]">
          Lembretes automáticos
        </p>
        <h1 className="mt-2 text-3xl font-bold">Automações</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          Acompanhe as mensagens programadas para cada cobrança e veja o status
          dos lembretes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatBox
          title="Total programadas"
          value={stats.total}
          icon={BellRing}
          className="bg-[#5B4BFF]/10 text-[#5B4BFF]"
        />

        <StatBox
          title="Pendentes"
          value={stats.pending}
          icon={Clock3}
          className="bg-amber-100 text-amber-700"
        />

        <StatBox
          title="Enviadas"
          value={stats.sent}
          icon={CheckCircle2}
          className="bg-emerald-100 text-emerald-700"
        />

        <StatBox
          title="Falharam"
          value={stats.failed}
          icon={XCircle}
          className="bg-red-100 text-red-700"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#070D2D]">
              Mensagens programadas
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Lista de lembretes criados a partir das cobranças.
            </p>
          </div>

          <div className="rounded-2xl bg-[#5B4BFF]/10 p-3 text-[#5B4BFF]">
            <MessageCircle size={22} />
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <p>Carregando automações...</p>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <CalendarClock className="mx-auto text-[#5B4BFF]" size={34} />
              <p className="mt-3 font-semibold text-[#070D2D]">
                Nenhuma automação programada ainda
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Ao criar uma cobrança com lembretes, ela aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const status = getStatusConfig(item.status)
                const StatusIcon = status.icon

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-4 transition hover:border-[#5B4BFF]/40 hover:bg-[#5B4BFF]/5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[#070D2D]">
                            {item.client?.name || 'Cliente não informado'}
                          </p>

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                          >
                            <StatusIcon size={13} />
                            {status.label}
                          </span>

                          <span className="rounded-full bg-[#5B4BFF]/10 px-3 py-1 text-xs font-semibold text-[#5B4BFF]">
                            {getMessageLabel(item.message_type)}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-slate-600">
                          {item.charge?.description || 'Cobrança sem descrição'}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {formatPhone(item.client?.phone || '')}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4 text-sm md:text-right">
                        <p className="font-medium text-[#070D2D]">
                          {item.scheduled_for
                            ? formatDate(item.scheduled_for.slice(0, 10))
                            : '-'}
                        </p>
                        <p className="mt-1 text-slate-500">
                          {formatCurrency(item.charge?.amount || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}